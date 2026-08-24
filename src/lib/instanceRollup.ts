import { layerResourcePercents } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { fmtMs } from './format'

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
  return m.podReplicas.map((pod) => {
    const cpuPct =
      m.cpuLimit > 0
        ? Math.min(100, (pod.cpuUsage / m.cpuLimit) * 100)
        : Math.min(100, pod.cpuUsage * 100)
    const memPct =
      pod.memoryBytes > 0 && m.memoryLimit > 0
        ? Math.min(100, (pod.memoryBytes / m.memoryLimit) * 100)
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
  if (p99Seconds == null || p99Seconds <= 0) return '—'
  return fmtMs(p99Seconds * 1000)
}
