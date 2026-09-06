import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import {
  useMetricsStore,
  type MetricsBucket,
} from '../../editor-core/stores/metricsStore'
import { useChaosStore } from '../../editor-core/stores/chaosStore'
import { createCanvasNode } from '../../lib/nodeFactory'
import { clearCanvasHistory } from '../../lib/canvasHistory'
import { isoToNode } from '../../canvas/utils/positionAdapter'
import {
  installCanvasSvgBridge,
  resetCanvasSvgBridgeForTests,
  useSvgCanvasStore,
} from '../store/svgCanvasStore'

vi.mock('../../lib/featureFlags', () => ({
  SHOW_SIMULATION_UI: true,
}))

function highCpuMetrics(): MetricsBucket {
  return {
    cpuUsage: 0.9,
    cpuPercent: 90,
    memoryBytes: 0,
    memPercent: 10,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 1,
    memoryLimit: 1024,
    requestRate: 1,
    errorRate: 0,
    totalRequests: 1,
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
    maxConnections: 0,
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
    lastUpdated: Date.now(),
    qps: 0,
  } as MetricsBucket
}

describe('canvasSvgBridge', () => {
  beforeEach(() => {
    resetCanvasSvgBridgeForTests()
    clearCanvasHistory()
    useCanvasStore.getState().clearCanvas()
    useCanvasStore.getState().setMode('design')
    useCanvasStore.getState().setDeploymentId(null)
    useMetricsStore.getState().clearMetrics()
    useChaosStore.getState().clear()
  })

  it('projects canvasStore nodes into the SVG store after install', () => {
    const node = createCanvasNode('database', isoToNode(1, 1), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    const svgNodes = useSvgCanvasStore.getState().nodes
    expect(svgNodes).toHaveLength(1)
    expect(svgNodes[0].id).toBe(node.id)
    expect(svgNodes[0].archetype).toBe('database')
    expect(svgNodes[0].engine).toBe('postgresql')
  })

  it('writes SVG placeNodeAt into canvasStore', () => {
    installCanvasSvgBridge()
    useCanvasStore.getState().clearCanvas()
    useSvgCanvasStore.getState().setPlacingArchetype('cache')
    useSvgCanvasStore.getState().placeNodeAt(0, 0)
    const canvasNodes = Object.values(useCanvasStore.getState().nodes)
    expect(canvasNodes).toHaveLength(1)
    expect(canvasNodes[0].type).toBe('cache')
    expect(useSvgCanvasStore.getState().nodes[0].archetype).toBe('cache')
  })

  it('syncs replica edits through config.replicas', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useSvgCanvasStore.getState().setNodeReplicas(node.id, 3)
    expect(useCanvasStore.getState().nodes[node.id].config.replicas).toBe(3)
    expect(
      useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
        ?.topology.replicas,
    ).toBe(3)
  })

  it('shares selection with canvasStore', () => {
    const node = createCanvasNode('worker', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useSvgCanvasStore.getState().selectOnly(node.id)
    expect(useCanvasStore.getState().selectedId).toBe(node.id)
    expect(useCanvasStore.getState().selectedIds).toEqual([node.id])
  })

  it('preserves healthVisual across canvas sync', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useSvgCanvasStore.getState().setNodeHealthVisual([node.id], 'warning')
    useCanvasStore.getState().updateNodeLabel(node.id, 'Renamed')
    const svg = useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
    expect(svg?.healthVisual).toBe('warning')
    expect(svg?.label).toBe('Renamed')
  })

  it('drives healthVisual from metrics in simulate mode', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    node.status = 'healthy'
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useCanvasStore.getState().setMode('simulate')
    useMetricsStore.getState().setLatestMetrics(node.id, highCpuMetrics())
    const svg = useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
    expect(svg?.healthVisual).toBe('warning')
  })

  it('clears live health when returning to design', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    node.status = 'healthy'
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useCanvasStore.getState().setMode('simulate')
    useMetricsStore.getState().setLatestMetrics(node.id, highCpuMetrics())
    expect(
      useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
        ?.healthVisual,
    ).toBe('warning')
    useCanvasStore.getState().setMode('design')
    expect(
      useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
        ?.healthVisual,
    ).toBe('off')
  })

  it('applies chaos rim over metrics in live mode', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    node.status = 'healthy'
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useCanvasStore.getState().setMode('live')
    useMetricsStore.getState().setLatestMetrics(node.id, highCpuMetrics())
    useChaosStore.getState().register('pod_kill', 'app-server')
    expect(
      useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
        ?.healthVisual,
    ).toBe('chaos')
  })

  it('projects CanvasEdge.animated as trafficEnabled', () => {
    const a = createCanvasNode('compute', isoToNode(0, 0), {})
    const b = createCanvasNode('database', isoToNode(2, 0), {})
    useCanvasStore.getState().addNode(a)
    useCanvasStore.getState().addNode(b)
    const edge = {
      id: crypto.randomUUID(),
      sourceId: a.id,
      targetId: b.id,
      protocol: 'http' as const,
      animated: true,
    }
    useCanvasStore.getState().addEdge(edge)
    installCanvasSvgBridge()
    const svgEdge = useSvgCanvasStore.getState().edges.find((e) => e.id === edge.id)
    expect(svgEdge?.trafficEnabled).toBe(true)
  })

  it('projects CanvasEdge.protocol onto SvgEdge', () => {
    const a = createCanvasNode('compute', isoToNode(0, 0), {})
    const b = createCanvasNode('cache', isoToNode(2, 0), {})
    useCanvasStore.getState().addNode(a)
    useCanvasStore.getState().addNode(b)
    const edge = {
      id: crypto.randomUUID(),
      sourceId: a.id,
      targetId: b.id,
      protocol: 'tcp' as const,
      animated: false,
    }
    useCanvasStore.getState().addEdge(edge)
    installCanvasSvgBridge()
    const svgEdge = useSvgCanvasStore.getState().edges.find((e) => e.id === edge.id)
    expect(svgEdge?.protocol).toBe('tcp')
  })
})
