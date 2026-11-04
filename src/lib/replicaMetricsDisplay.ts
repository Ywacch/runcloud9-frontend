import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { ReplicaMetrics } from '../editor-core/domain/simulation/types'
import { perReplicaLimit } from './instanceRollup'

export function shortPodLabel(name: string, index: number): string {
  const trimmed = name.trim()
  if (!trimmed) return `pod ${index + 1}`
  return compactPodName(trimmed) || `pod ${index + 1}`
}

/** Short label for inspector replica rows — keeps the unique pod suffix. */
export function compactPodName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  const parts = trimmed.split('-')
  if (parts.length >= 2) {
    return parts.slice(-2).join('-')
  }
  return trimmed.length > 18 ? `${trimmed.slice(0, 16)}…` : trimmed
}

export interface ReplicaInspectorRow extends ReplicaMetrics {
  podName: string
  ready: boolean
  memoryBytes: number
  memPercent: number | null
}

/** Map live WS per-pod rows to inspector replica tabs (simulation shape). */
export function replicaBreakdownFromPods(
  pods: PodReplicaMetrics[],
  cpuLimitCores: number,
  memoryLimitBytes: number,
): ReplicaInspectorRow[] {
  const cpuLimitPerPod = perReplicaLimit(cpuLimitCores, pods.length)
  const memLimitPerPod = perReplicaLimit(memoryLimitBytes, pods.length)

  return pods.map((p, i) => {
    const cpuPercent: number | null =
      cpuLimitPerPod > 0
        ? Math.min(100, (p.cpuUsage / cpuLimitPerPod) * 100)
        : null
    const memoryGb =
      p.memoryBytes > 0 ? p.memoryBytes / (1024 * 1024 * 1024) : 0
    const memPercent: number | null =
      p.memoryBytes > 0 && memLimitPerPod > 0
        ? Math.min(100, (p.memoryBytes / memLimitPerPod) * 100)
        : null
    const util = (cpuPercent ?? 0) / 100
    return {
      podName: p.name,
      ready: p.ready,
      label: shortPodLabel(p.name, i),
      qps: p.requestRate,
      cpuPercent: cpuPercent ?? 0,
      memoryGb,
      memoryBytes: p.memoryBytes,
      latencyMs: p.p99LatencyMs,
      errorRate: p.errorRate,
      utilizationPct: util,
      memPercent,
    }
  })
}

/** Simulation rows already carry memory; normalize for shared UI. */
export function replicaRowFromSimulation(r: ReplicaMetrics): ReplicaInspectorRow {
  return {
    ...r,
    podName: r.label,
    ready: true,
    memoryBytes: r.memoryGb > 0 ? r.memoryGb * 1024 * 1024 * 1024 : 0,
    memPercent: 0,
  }
}
