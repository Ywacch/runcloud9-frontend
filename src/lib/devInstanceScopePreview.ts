import { useEffect } from 'react'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import {
  isMetricsViewportMode,
  useCanvasStore,
  type CanvasEdge,
  type CanvasMode,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useSvgCanvasStore } from '../svg-canvas/store/svgCanvasStore'
import type { SvgNode } from '../svg-canvas/store/svgTypes'
import {
  DB_LAYER_ID_POSTGRES_PRIMARY,
} from './dbInstanceScope'
import { clampAppServerReplicas, clampReadReplicas, lbAlgorithmForDeploy } from './replicaConfig'
import { seedDevInspectorLogs } from './devInspectorFixtures'

/** Temporary DEV hook: exercise inspector + metrics UX in design mode without a deploy. */
export function devInstanceScopePreviewEnabled(mode: CanvasMode): boolean {
  return import.meta.env.DEV && mode === 'design'
}

export function isInstanceScopeViewportMode(mode: CanvasMode): boolean {
  return isMetricsViewportMode(mode) || devInstanceScopePreviewEnabled(mode)
}

const DEV_HISTORY_POINTS = 24

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
  if (node.type === 'compute' || node.type === 'worker') {
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
    dbQueryRate: role === 'primary' ? 18 + index * 4 : 12 + index * 3,
    p50LatencyMs: 12 + index * 4,
    p99LatencyMs: 45 + index * 18,
    storageIo: {
      readRate: 22 + index * 6,
      writeRate: 4 + index,
      readTotal9m: 8000 + index * 1200,
      writeTotal9m: 900 + index * 200,
      unit: 'rows/s',
      source: 'postgres_exporter',
    },
  }
}

function podReplicaRow(
  node: CanvasNode,
  index: number,
  requestRate: number,
): MetricsBucket['podReplicas'][number] {
  const name = `${node.id}-roll-${String.fromCharCode(97 + index)}`
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
}

function buildComputeWorkerMetrics(
  node: CanvasNode,
  svgNode: SvgNode | undefined,
): MetricsBucket {
  const replicaCount = Math.max(1, visualReplicaCount(node, svgNode))
  const podReplicas = Array.from({ length: replicaCount }, (_, index) =>
    podReplicaRow(node, index, 120 - index * 18),
  )
  const clusterRps = podReplicas.reduce((sum, pod) => sum + pod.requestRate, 0)
  return emptyMetricsBucket({
    cpuUsage: 0.42,
    cpuPercent: 42,
    memoryBytes: 384 * 1024 * 1024,
    memPercent: 75,
    requestRate: clusterRps,
    errorRate: 0.01,
    totalRequests: 18_400,
    totalErrors9m: 12,
    p50Latency: 32,
    p95Latency: 110,
    p99Latency: 180,
    p50Latency9m: 28,
    p95Latency9m: 98,
    p99Latency9m: 165,
    podReplicas,
    podCount: replicaCount,
    runtimeHealth:
      replicaCount > 1
        ? {
            pods: podReplicas.map((pod) => ({
              name: pod.name,
              ready: pod.ready,
              restartCount: pod.ready ? 0 : 1,
            })),
            unreadyCount: podReplicas.filter((pod) => !pod.ready).length,
            restarting: false,
          }
        : null,
  })
}

function buildDatabaseMetrics(
  node: CanvasNode,
  svgNode: SvgNode | undefined,
): MetricsBucket {
  const replicaCount = Math.max(1, visualReplicaCount(node, svgNode))
  const replicaLayers =
    replicaCount > 1
      ? Array.from({ length: replicaCount - 1 }, (_, index) =>
          layerMetrics(`${node.id}-replica-${index + 1}`, 'replica', index + 1),
        )
      : []
  const layers = [layerMetrics(DB_LAYER_ID_POSTGRES_PRIMARY, 'primary', 0), ...replicaLayers]
  const dbQueryRate = layers.reduce((sum, layer) => sum + (layer.dbQueryRate ?? 0), 0)
  return emptyMetricsBucket({
    cpuUsage: 0.22,
    cpuPercent: 22,
    memoryBytes: 320 * 1024 * 1024,
    memPercent: 62,
    requestRate: dbQueryRate,
    dbQueryRate,
    dbTotalQueries: 42_800,
    dbQueryLatency: 0.0052,
    dbQuerySource: 'app',
    dbActiveConnections: 14,
    maxConnections: Number(node.config.maxConnections ?? 100),
    storageEngine: 'postgresql',
    storageRole: 'primary',
    storageIo: {
      readRate: 38,
      writeRate: 9,
      readTotal9m: 12_400,
      writeTotal9m: 2_100,
      unit: 'rows/s',
      source: 'postgres_exporter',
    },
    p50Latency: 18,
    p95Latency: 42,
    p99Latency: 88,
    p50Latency9m: 16,
    p95Latency9m: 39,
    p99Latency9m: 82,
    layers,
    podCount: replicaCount,
  })
}

function buildCacheMetrics(node: CanvasNode): MetricsBucket {
  const hits = 186
  const misses = 42
  return emptyMetricsBucket({
    cpuUsage: 0.11,
    cpuPercent: 18,
    memoryBytes: 96 * 1024 * 1024,
    memPercent: 48,
    memoryLimit: 200 * 1024 * 1024,
    requestRate: hits + misses,
    cacheHits: hits,
    cacheMisses: misses,
    cacheHitsLast9m: 48_200,
    cacheMissesLast9m: 9_800,
    redisKeyspaceHits: hits,
    redisKeyspaceMisses: misses,
    redisOpsPerSec: hits + misses + 12,
    redisConnectedClients: 8,
    redisAvgLatency: 0.0012,
    redisMaxClients: 10_000,
    storageEngine: 'redis',
    storageRole: 'cache',
    cacheStrategy: String(node.config.cacheStrategy ?? 'cache-aside'),
    storageIo: {
      readRate: hits,
      writeRate: 18,
      readTotal9m: 48_200,
      writeTotal9m: 4_600,
      unit: 'ops/s',
      source: 'redis_exporter',
    },
    evictionsPerSec: 0.4,
    expirationsPerSec: 1.2,
  })
}

function buildLoadBalancerMetrics(
  node: CanvasNode,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): MetricsBucket {
  const backends = Object.values(edges)
    .filter((edge) => edge.sourceId === node.id)
    .map((edge) => nodes[edge.targetId])
    .filter((backend): backend is CanvasNode => Boolean(backend))
  const backendPods = backends.map((backend, index) =>
    podReplicaRow(backend, index, 88 - index * 14),
  )
  const requestRate = backendPods.reduce((sum, pod) => sum + pod.requestRate, 0)
  const perBackendRps = Object.fromEntries(
    backendPods.map((pod) => [pod.name, pod.requestRate]),
  )
  return emptyMetricsBucket({
    cpuUsage: 0.06,
    cpuPercent: 12,
    memoryBytes: 64 * 1024 * 1024,
    memPercent: 28,
    requestRate,
    errorRate: 0.002,
    totalRequests: 24_600,
    p50Latency: 8,
    p95Latency: 22,
    p99Latency: 48,
    activeConnections: 42,
    lbConnectionLimit: 1024,
    lbAlgorithm: lbAlgorithmForDeploy(node.config),
    backendPods,
    perBackendRps,
    lbBackends: backends.map((backend) => backend.label),
  })
}

function buildMessageQueueMetrics(node: CanvasNode): MetricsBucket {
  const depth = 128
  return emptyMetricsBucket({
    cpuUsage: 0.14,
    cpuPercent: 24,
    memoryBytes: 180 * 1024 * 1024,
    memPercent: 55,
    queueDepth: depth,
    produceRate: 64,
    consumeRate: 58,
    messagesReady: depth,
    messagesUnacked: 6,
    mqMemoryUsed: 180 * 1024 * 1024,
    mqMemoryLimit: 256 * 1024 * 1024,
    mqSaturationRatio: 0.42,
    storageEngine: 'rabbitmq',
    storageRole: 'broker',
  })
}

export function buildDevInstanceScopeMetrics(
  node: CanvasNode,
  svgNode: SvgNode | undefined,
  nodes: Record<string, CanvasNode> = {},
  edges: Record<string, CanvasEdge> = {},
): MetricsBucket | null {
  switch (node.type) {
    case 'compute':
    case 'worker':
      return buildComputeWorkerMetrics(node, svgNode)
    case 'database':
      return buildDatabaseMetrics(node, svgNode)
    case 'cache':
      return buildCacheMetrics(node)
    case 'load_balancer':
      return buildLoadBalancerMetrics(node, nodes, edges)
    case 'message_queue':
      return buildMessageQueueMetrics(node)
    default:
      return null
  }
}

function wobble(seed: number, index: number): number {
  return 0.88 + 0.12 * Math.sin(index * 0.65 + seed)
}

function jitterBucket(base: MetricsBucket, nodeId: string, index: number): MetricsBucket {
  const seed = nodeId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const factor = wobble(seed, index)
  return {
    ...base,
    requestRate: base.requestRate * factor,
    cpuPercent: Math.min(99, base.cpuPercent * factor),
    memPercent: Math.min(99, base.memPercent * (1.04 - factor * 0.04)),
    p99Latency: base.p99Latency * (0.92 + (index % 5) * 0.03),
    cacheHits: base.cacheHits * factor,
    cacheMisses: base.cacheMisses * (1.08 - factor * 0.04),
    dbQueryRate: base.dbQueryRate * factor,
    queueDepth: Math.round(base.queueDepth * (0.9 + (index % 4) * 0.05)),
    lastUpdated: Date.now() - (DEV_HISTORY_POINTS - index) * 10_000,
  }
}

function seedDevMetricsHistory(nodeId: string, latest: MetricsBucket): void {
  const store = useMetricsStore.getState()
  if ((store.history[nodeId]?.length ?? 0) >= 12) {
    store.setLatestMetrics(nodeId, latest)
    return
  }
  for (let i = 0; i < DEV_HISTORY_POINTS; i++) {
    store.updateMetrics(nodeId, jitterBucket(latest, nodeId, i))
  }
}

function ensureDevLoadgenFixture(): void {
  const { loadgen, setLoadgen } = useMetricsStore.getState()
  if (loadgen?.active) return
  setLoadgen({
    active: true,
    targetRps: 120,
    currentRps: 120,
    actualRps: 118,
    intervalActualRps: 118,
    intervalP99Ms: 165,
    recentIntervals: [],
    recentLatenciesMs: [42, 55, 61, 48, 72, 88, 54, 39],
    totalRequests: 24_000,
    successRate: 0.992,
    durationSeconds: 540,
    elapsedSeconds: 180,
    statusCodes: { '200': 23800, '500': 12, '499': 4 },
  })
}

export function syncDevInstanceScopeMetrics(
  mode: CanvasMode,
  nodes: Record<string, CanvasNode>,
  svgNodes: SvgNode[],
  edges: Record<string, CanvasEdge> = {},
): void {
  if (!devInstanceScopePreviewEnabled(mode)) return

  seedDevInspectorLogs(nodes)
  ensureDevLoadgenFixture()
  const svgById = new Map(svgNodes.map((node) => [node.id, node]))

  for (const node of Object.values(nodes)) {
    const metrics = buildDevInstanceScopeMetrics(
      node,
      svgById.get(node.id),
      nodes,
      edges,
    )
    if (!metrics) continue
    seedDevMetricsHistory(node.id, metrics)
  }
}

export function useDevInstanceScopePreview(
  mode: CanvasMode,
  nodes: Record<string, CanvasNode>,
): void {
  const svgNodes = useSvgCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  useEffect(() => {
    syncDevInstanceScopeMetrics(mode, nodes, svgNodes, edges)
  }, [mode, nodes, svgNodes, edges])
}
