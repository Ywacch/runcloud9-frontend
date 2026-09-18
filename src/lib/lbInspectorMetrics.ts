import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'

/** Sum live per-pod request rates (matches backend Prometheus rollup). */
export function sumPodRequestRates(pods: PodReplicaMetrics[]): number {
  return pods.reduce((sum, pod) => sum + (pod.requestRate > 0 ? pod.requestRate : 0), 0)
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
