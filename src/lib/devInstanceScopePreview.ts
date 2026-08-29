import { useEffect } from 'react'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import {
  isMetricsViewportMode,
  type CanvasMode,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useSvgCanvasStore } from '../svg-canvas/store/svgCanvasStore'
import type { SvgNode } from '../svg-canvas/store/svgTypes'
import {
  DB_LAYER_ID_POSTGRES_PRIMARY,
  nodeSupportsInstanceScope,
} from './dbInstanceScope'
import { clampAppServerReplicas, clampReadReplicas } from './replicaConfig'

/** Temporary DEV hook: exercise instance-scope UX in design mode without a deploy. */
export function devInstanceScopePreviewEnabled(mode: CanvasMode): boolean {
  return import.meta.env.DEV && mode === 'design'
}

export function isInstanceScopeViewportMode(mode: CanvasMode): boolean {
  return isMetricsViewportMode(mode) || devInstanceScopePreviewEnabled(mode)
}

function emptyMetricsBucket(partial: Partial<MetricsBucket> = {}): MetricsBucket {
  return {
    cpuUsage: 0,
    cpuPercent: 0,
    memoryBytes: 0,
    memPercent: 0,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 1,
    memoryLimit: 512 * 1024 * 1024,
    requestRate: 0,
    errorRate: 0,
    totalRequests: 0,
    totalErrors9m: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    p50Latency9m: 0,
    p95Latency9m: 0,
    p99Latency9m: 0,
    avgLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitsLast9m: 0,
    cacheMissesLast9m: 0,
    dbQueryRate: 0,
    dbTotalQueries: 0,
    dbQueryLatency: 0,
    dbQuerySource: '',
    dbActiveConnections: 0,
    maxConnections: 100,
    storageEngine: '',
    storageRole: '',
    storageIo: null,
    activeConnections: 0,
    lbConnectionLimit: 0,
    queueDepth: 0,
    produceRate: 0,
    consumeRate: 0,
    messagesReady: 0,
    messagesUnacked: 0,
    mqMemoryUsed: 0,
    mqMemoryLimit: 0,
    mqSaturationRatio: 0,
    workerSaturation: 0,
    redisMaxClients: 0,
    perBackendRps: {},
    lbAlgorithm: '',
    lbBackends: [],
    podReplicas: [],
    backendPods: [],
    backendReplicas: null,
    runtimeHealth: null,
    layers: [],
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

function visualReplicaCount(node: CanvasNode, svgNode: SvgNode | undefined): number {
  if (svgNode?.topology.replicas != null && svgNode.topology.replicas > 1) {
    return svgNode.topology.replicas
  }
  if (node.type === 'compute') {
    return clampAppServerReplicas(node.config.replicas)
  }
  if (node.type === 'database') {
    return 1 + clampReadReplicas(node.config.readReplicas)
  }
  return 1
}

function layerMetrics(
  id: string,
  role: ComponentLayerMetrics['role'],
  index: number,
): ComponentLayerMetrics {
  const cpuUsage = 0.08 + index * 0.03
  const memBytes = (128 + index * 32) * 1024 * 1024
  return {
    id,
    role,
    engine: 'postgresql',
    cpuUsage,
    memoryBytes: memBytes,
    cpuLimit: 1,
    memoryLimit: 512 * 1024 * 1024,
    cpuIsEstimated: false,
    memIsEstimated: false,
    requestRate: 40 + index * 12,
    replicationLagSeconds: role === 'replica' ? 0.04 + index * 0.02 : undefined,
  }
}

export function buildDevInstanceScopeMetrics(
  node: CanvasNode,
  svgNode: SvgNode | undefined,
): MetricsBucket | null {
  const replicaCount = visualReplicaCount(node, svgNode)
  if (replicaCount <= 1) return null

  if (node.type === 'database') {
    const replicaLayers = Array.from({ length: replicaCount - 1 }, (_, index) =>
      layerMetrics(`${node.id}-replica-${index + 1}`, 'replica', index + 1),
    )
    const layers = [layerMetrics(DB_LAYER_ID_POSTGRES_PRIMARY, 'primary', 0), ...replicaLayers]
    const dbQueryRate = layers.reduce((sum, layer) => sum + (layer.requestRate ?? 0), 0)
    return emptyMetricsBucket({
      cpuUsage: 0.22,
      cpuPercent: 22,
      memoryBytes: 320 * 1024 * 1024,
      memPercent: 62,
      requestRate: dbQueryRate,
      dbQueryRate,
      p50Latency: 18,
      p95Latency: 42,
      p99Latency: 88,
      layers,
      podCount: replicaCount,
    })
  }

  if (node.type !== 'compute') return null

  const podReplicas = Array.from({ length: replicaCount }, (_, index) => {
    const name = `${node.id}-roll-${String.fromCharCode(97 + index)}`
    const requestRate = 120 - index * 18
    const cpuUsage = 0.18 + index * 0.05
    const memoryBytes = (160 + index * 24) * 1024 * 1024
    return {
      name,
      ready: index !== 1,
      requestRate,
      p99LatencyMs: 95 + index * 40,
      totalRequests: 1200 + index * 300,
      cpuUsage,
      errorRate: index === 1 ? 0.02 : 0,
      memoryBytes,
    }
  })

  const clusterRps = podReplicas.reduce((sum, pod) => sum + pod.requestRate, 0)
  return emptyMetricsBucket({
    cpuUsage: 0.42,
    cpuPercent: 42,
    memoryBytes: 384 * 1024 * 1024,
    memPercent: 75,
    requestRate: clusterRps,
    errorRate: 0.01,
    p50Latency: 32,
    p95Latency: 110,
    p99Latency: 180,
    podReplicas,
    podCount: replicaCount,
    runtimeHealth: {
      pods: podReplicas.map((pod) => ({
        name: pod.name,
        ready: pod.ready,
        restartCount: pod.ready ? 0 : 1,
      })),
      unreadyCount: podReplicas.filter((pod) => !pod.ready).length,
      restarting: false,
    },
  })
}

export function syncDevInstanceScopeMetrics(
  mode: CanvasMode,
  nodes: Record<string, CanvasNode>,
  svgNodes: SvgNode[],
): void {
  if (!devInstanceScopePreviewEnabled(mode)) return

  const svgById = new Map(svgNodes.map((node) => [node.id, node]))
  const setLatestMetrics = useMetricsStore.getState().setLatestMetrics

  for (const node of Object.values(nodes)) {
    if (!nodeSupportsInstanceScope(node)) continue
    const metrics = buildDevInstanceScopeMetrics(node, svgById.get(node.id))
    if (!metrics) continue
    setLatestMetrics(node.id, metrics)
  }
}

export function useDevInstanceScopePreview(
  mode: CanvasMode,
  nodes: Record<string, CanvasNode>,
): void {
  const svgNodes = useSvgCanvasStore((s) => s.nodes)

  useEffect(() => {
    syncDevInstanceScopeMetrics(mode, nodes, svgNodes)
  }, [mode, nodes, svgNodes])
}
