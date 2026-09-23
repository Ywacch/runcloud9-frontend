import { isCpuUtilWarn, isMemUtilWarn } from '../editor-core/domain/healthThresholds'
import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { fmtInt, fmtLatencyCell } from './format'
import { compactPodName, replicaBreakdownFromPods } from './replicaMetricsDisplay'

/** Sum live per-pod request rates (matches backend Prometheus rollup). */
export function sumPodRequestRates(pods: PodReplicaMetrics[]): number {
  return pods.reduce((sum, pod) => sum + (pod.requestRate > 0 ? pod.requestRate : 0), 0)
}

/** Compute nodes wired downstream of this load balancer. */
export function lbConnectedComputeNodes(
  lbNodeId: string,
  edges: Record<string, CanvasEdge>,
  nodes: Record<string, CanvasNode>,
): CanvasNode[] {
  return Object.values(edges)
    .filter((edge) => edge.sourceId === lbNodeId)
    .map((edge) => nodes[edge.targetId])
    .filter((node): node is CanvasNode => node?.type === 'compute')
}

/** Backend pod rows for the LB inspector (`lb.backendPods`, else `perBackendRps`). */
export function lbInspectorBackendPods(m: MetricsBucket): PodReplicaMetrics[] {
  if (m.backendPods.length > 0) return m.backendPods
  const entries = Object.entries(m.perBackendRps)
  if (entries.length === 0) return []
  return entries.map(([name, requestRate]) => ({
    name,
    ready: true,
    requestRate,
    p99LatencyMs: 0,
    totalRequests: 0,
    cpuUsage: 0,
    errorRate: 0,
    memoryBytes: 0,
  }))
}

export type LbBackendTableRow = {
  name: string
  rps: string
  cpu: string
  mem: string
  p99: string
  share: string
  status: 'ok' | 'warn' | 'bad'
  cpuTone?: 'am'
  memTone?: 'am'
}

export function lbBackendTableRows(
  m: MetricsBucket,
  limits: { cpuLimitCores: number; memoryLimitBytes: number },
): LbBackendTableRow[] {
  const pods = lbInspectorBackendPods(m)
  const totalRps = sumPodRequestRates(pods) || m.requestRate
  const breakdown = replicaBreakdownFromPods(
    pods,
    limits.cpuLimitCores,
    limits.memoryLimitBytes,
  )
  return breakdown.map((row) => {
    const share = totalRps > 0 ? Math.round((row.qps / totalRps) * 100) : 0
    return {
      name: compactPodName(row.podName) || row.podName,
      rps: fmtInt(row.qps),
      cpu: `${Math.round(row.cpuPercent)}%`,
      mem: `${Math.round(row.memPercent)}%`,
      p99: row.latencyMs > 0 ? fmtLatencyCell(row.latencyMs) : '—',
      share: `${share}%`,
      status: row.ready ? 'ok' : 'bad',
      cpuTone: isCpuUtilWarn(row.cpuPercent) ? 'am' : undefined,
      memTone: isMemUtilWarn(row.memPercent) ? 'am' : undefined,
    }
  })
}

export function lbBackendSkewLabel(pods: PodReplicaMetrics[]): string | null {
  const total = sumPodRequestRates(pods)
  if (pods.length < 2 || total <= 0) return null
  const shares = pods
    .map((pod) => ({
      share: Math.round((pod.requestRate / total) * 100),
    }))
    .sort((a, b) => b.share - a.share)
  return shares.map((row) => row.share).join(' / ')
}

/**
 * Resource limits for pods listed under the LB inspector.
 * Backend pods are app-server replicas; use the connected compute bucket limits.
 */
export function lbBackendResourceLimits(
  lbNodeId: string,
  edges: Record<string, CanvasEdge>,
  nodes: Record<string, CanvasNode>,
  allMetrics: Record<string, MetricsBucket>,
): { cpuLimitCores: number; memoryLimitBytes: number } {
  const backendNodes = Object.values(edges)
    .filter((edge) => edge.sourceId === lbNodeId)
    .map((edge) => nodes[edge.targetId])
    .filter((node): node is CanvasNode => node?.type === 'compute')

  for (const backend of backendNodes) {
    const bucket = allMetrics[backend.id]
    if (!bucket) continue
    if (bucket.cpuLimit > 0 || bucket.memoryLimit > 0) {
      return {
        cpuLimitCores: bucket.cpuLimit,
        memoryLimitBytes: bucket.memoryLimit,
      }
    }
  }

  return { cpuLimitCores: 0, memoryLimitBytes: 0 }
}
