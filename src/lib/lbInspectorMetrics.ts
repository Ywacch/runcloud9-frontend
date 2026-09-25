import { isCpuUtilWarn, isMemUtilWarn } from '../editor-core/domain/healthThresholds'
import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { fmtInt, fmtLatencyCell } from './format'
import { compactPodName, replicaBreakdownFromPods } from './replicaMetricsDisplay'
import { clampAppServerReplicas, type LiveLBAlgorithm } from './replicaConfig'

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

export function lbAlgorithmDisplayName(algo: LiveLBAlgorithm): string {
  switch (algo) {
    case 'least_conn':
      return 'least connections'
    case 'least_time':
      return 'least time'
    case 'ip_hash':
      return 'ip hash'
    case 'random':
      return 'random'
    default:
      return 'round-robin'
  }
}

/** Inspector copy for uneven backend share (algorithm-specific, not round-robin boilerplate). */
export function lbSkewExplanation(algo: LiveLBAlgorithm): string {
  switch (algo) {
    case 'ip_hash':
      return 'ip hash pins a client subnet to one backend, so an uneven split is normal when clients cluster or connections stay open.'
    case 'least_conn':
      return 'least connections favors backends with fewer active connections, but keep-alive reuse can still skew what you observe.'
    case 'least_time':
      return 'least time favors lower-latency backends, but keep-alive reuse can still skew what you observe.'
    case 'random':
      return 'random picks a backend per request, but keep-alive reuse can still skew what you observe.'
    default:
      return 'round-robin rotates across backends in order, but keep-alive reuse can skew what you observe.'
  }
}

/** Live config backends line: compute labels with replica counts from canvas config. */
export function lbBackendConfigValue(
  lbNodeId: string,
  edges: Record<string, CanvasEdge>,
  nodes: Record<string, CanvasNode>,
  m?: MetricsBucket,
): string | null {
  const backends = lbConnectedComputeNodes(lbNodeId, edges, nodes)
  if (backends.length === 0) return null
  const podCount = m?.backendPods?.length ?? 0
  if (podCount > 0 && backends.length === 1) {
    const backend = backends[0]!
    const configured = clampAppServerReplicas(backend.config.replicas)
    if (podCount !== configured) {
      return `${backend.label} · ${podCount} pods live`
    }
  }
  return backends
    .map((backend) => {
      const reps = clampAppServerReplicas(backend.config.replicas)
      return reps > 1 ? `${backend.label} ×${reps}` : backend.label
    })
    .join(', ')
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
