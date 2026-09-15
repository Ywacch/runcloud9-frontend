import { layerResourcePercents } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { FMT_EMPTY, fmtMs } from './format'

export type InstanceSample = {
  id: string
  role?: string
  cpuPct: number
  memPct: number
  rps?: number
  /** Seconds; omit when unknown. */
  p99?: number
  lagSeconds?: number
}

export type Rollup = {
  cpuPct: number
  memPct: number
  rps: number
  p99: number | null
  lagSeconds: number | null
  idle: boolean
}

function meanFinite(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return 0
  return finite.reduce((sum, v) => sum + v, 0) / finite.length
}

export function rollup(samples: InstanceSample[], opts?: { idleFloor?: number }): Rollup {
  const cpuPct = Math.round(meanFinite(samples.map((s) => s.cpuPct)))
  const memPct = Math.round(meanFinite(samples.map((s) => s.memPct)))
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
  const memFallbackBytes = 512 * 1024 * 1024

  return m.podReplicas.map((pod) => {
    const cpuPct =
      cpuLimitPerPod > 0
        ? Math.min(100, (pod.cpuUsage / cpuLimitPerPod) * 100)
        : Math.min(100, pod.cpuUsage * 100)
    const memPct =
      pod.memoryBytes > 0 && memLimitPerPod > 0
        ? Math.min(100, (pod.memoryBytes / memLimitPerPod) * 100)
        : pod.memoryBytes > 0
          ? Math.min(100, (pod.memoryBytes / memFallbackBytes) * 100)
          : 0
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
      lagSeconds: layer.replicationLagSeconds,
    }
  })
}

/** Canvas tooltip p99: missing or non-positive → em dash. */
export function tooltipP99Label(p99Seconds: number | null | undefined): string {
  if (p99Seconds == null || p99Seconds <= 0) return FMT_EMPTY
  return fmtMs(p99Seconds * 1000)
}
