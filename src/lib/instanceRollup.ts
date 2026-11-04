import {
  layerResourcePercents,
  type ComponentLayerMetrics,
} from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { FMT_EMPTY, fmtMs, utilizationPercent } from './format'

export type InstanceSample = {
  id: string
  role?: string
  cpuPct: number | null
  memPct: number | null
  rps?: number
  /** Seconds; omit when unknown. */
  p99?: number
  lagSeconds?: number
}

export type Rollup = {
  cpuPct: number | null
  memPct: number | null
  rps: number
  p99: number | null
  lagSeconds: number | null
  idle: boolean
}

function meanFinite(values: (number | null)[]): number | null {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (finite.length === 0) return null
  return finite.reduce((sum, v) => sum + v, 0) / finite.length
}

function roundPct(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v)
}

export function rollup(samples: InstanceSample[], opts?: { idleFloor?: number }): Rollup {
  const cpuPct = roundPct(meanFinite(samples.map((s) => s.cpuPct)))
  const memPct = roundPct(meanFinite(samples.map((s) => s.memPct)))
  const rps = samples.reduce((sum, s) => sum + (s.rps ?? 0), 0)

  const p99Values = samples
    .map((s) => s.p99)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const p99 = p99Values.length > 0 ? Math.max(...p99Values) : null

  const lagValues = samples
    .map((s) => s.lagSeconds)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const lagSeconds = lagValues.length > 0 ? Math.max(...lagValues) : null

  const idleFloor = opts?.idleFloor ?? Infinity
  return {
    cpuPct,
    memPct,
    rps,
    p99,
    lagSeconds,
    idle: rps < idleFloor,
  }
}

/** Cluster limit from the wire is summed across replicas; divide for per-pod %. */
export function perReplicaLimit(clusterLimit: number, replicaCount: number): number {
  if (!(clusterLimit > 0) || replicaCount < 1) return 0
  return clusterLimit / replicaCount
}

export function splitByRole(samples: InstanceSample[]): Map<string, InstanceSample[]> {
  const byRole = new Map<string, InstanceSample[]>()
  for (const sample of samples) {
    const role = sample.role?.trim() || 'unknown'
    const list = byRole.get(role) ?? []
    list.push(sample)
    byRole.set(role, list)
  }
  return byRole
}

export function samplesFromCompute(m: MetricsBucket): InstanceSample[] {
  const replicas = m.podReplicas.length
  const cpuLimitPerPod = perReplicaLimit(m.cpuLimit, replicas)
  const memLimitPerPod = perReplicaLimit(m.memoryLimit, replicas)

  return m.podReplicas.map((pod) => {
    const cpuPct =
      cpuLimitPerPod > 0
        ? utilizationPercent(pod.cpuUsage, cpuLimitPerPod)
        : null
    const memPct =
      memLimitPerPod > 0
        ? utilizationPercent(pod.memoryBytes, memLimitPerPod)
        : null
    return {
      id: pod.name,
      rps: pod.requestRate,
      p99: pod.p99LatencyMs > 0 ? pod.p99LatencyMs / 1000 : undefined,
      cpuPct,
      memPct,
    }
  })
}

export function samplesFromLayers(m: MetricsBucket): InstanceSample[] {
  return m.layers.map((layer) => {
    const { cpuPercent, memPercent } = layerResourcePercents(layer)
    return {
      id: layer.id,
      role: layer.role,
      cpuPct: cpuPercent,
      memPct: memPercent,
      rps: layer.requestRate,
      p99:
        layer.p99LatencyMs != null && layer.p99LatencyMs > 0
          ? layer.p99LatencyMs / 1000
          : undefined,
      lagSeconds: layer.replicationLagSeconds,
    }
  })
}

/** DB canvas tooltip latency — matches inspector DB Activity fallback order. */
export function dbTooltipLatencyMs(
  m: MetricsBucket,
  layer?: ComponentLayerMetrics,
): number | null {
  if (layer?.p99LatencyMs != null && layer.p99LatencyMs > 0) {
    return layer.p99LatencyMs
  }
  if (m.p99Latency > 0) return m.p99Latency
  if (m.dbQueryLatency > 0) return m.dbQueryLatency * 1000
  if (m.avgLatency > 0) return m.avgLatency
  return null
}

/** Canvas tooltip p99: missing or non-positive → em dash. */
export function tooltipP99Label(p99Seconds: number | null | undefined): string {
  if (p99Seconds == null || p99Seconds <= 0) return FMT_EMPTY
  return fmtMs(p99Seconds * 1000)
}
