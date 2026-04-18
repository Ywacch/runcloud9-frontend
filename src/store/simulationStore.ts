import { create } from 'zustand'
import { simulationStateToMetricsBucket } from '../lib/simulation/adapter'
import type {
  SimNodeInspector,
  SimulationTickResult,
} from '../lib/simulation/types'
import { normalizeWorkloadWeights } from '../lib/simulation/workload'
import { workloadProfileForTemplate } from '../lib/simulation/workloadProfiles'
import type {
  SimulationWorkerInMessage,
  SimulationWorkerOutMessage,
} from '../lib/simulation/simulation.worker'
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from './canvasStore'
import { useMetricsStore } from './metricsStore'

function createSimulationWorker(): Worker {
  return new Worker(
    new URL('../lib/simulation/simulation.worker.ts', import.meta.url),
    { type: 'module' }
  )
}

interface SimulationStoreState {
  running: boolean
  paused: boolean
  tick: number
  loadFactor: number
  /** Wall-clock multiplier for tick rate (simulated time vs real time). */
  simulationSpeed: number
  error: string | null
  /** Last tick cache deltas (per simulated second) for overlay/debug. */
  lastCacheHitsDelta: number
  lastCacheMissesDelta: number
  mqQueueDepth: Record<string, number>
  /** Latest per-node simulation inspector payload (simulate mode only). */
  lastInspector: Record<string, SimNodeInspector>
  /** Latest tick diagnostics (warnings). */
  lastDiagnostics: string[]
  /** Wall-clock time (ms) when the last tick message was received from the worker; null if none yet. */
  lastTickWallClockMs: number | null
  /** Latest per-edge QPS from the worker (connection id → qps). */
  lastEdgeFlows: Record<string, number>

  start: () => void
  stop: () => void
  pause: () => void
  resume: () => void
  setLoadFactor: (v: number) => void
  setSimulationSpeed: (v: number) => void
  reinitTopology: (nodes: CanvasNode[], edges: CanvasEdge[]) => void
}

let worker: Worker | null = null
const totalRequestsByNode: Record<string, number> = {}
let cacheHitsTotal = 0
let cacheMissesTotal = 0

function memoryLimitForNode(node: CanvasNode): number {
  if (node.type === 'compute') {
    const replicas = Math.max(1, Number(node.config.replicas ?? 1))
    return 0.5 * replicas
  }
  if (node.type === 'worker') {
    const replicas = Math.max(1, Number(node.config.replicas ?? 1))
    return 0.25 * replicas
  }
  if (node.type === 'cache') {
    const replicas = Math.max(1, Number(node.config.replicas ?? 1))
    const perMb = Math.max(128, Number(node.config.maxMemoryMB ?? 512))
    return (perMb / 1024) * replicas
  }
  if (node.type === 'database') {
    return Math.max(0.5, Number(node.config.storageGB ?? 10) * 0.25)
  }
  if (node.type === 'message_queue') return 1
  if (node.type === 'load_balancer') return 0.5
  return 0.5
}

function resetAccumulators(): void {
  for (const k of Object.keys(totalRequestsByNode)) delete totalRequestsByNode[k]
  cacheHitsTotal = 0
  cacheMissesTotal = 0
}

function applyTick(result: SimulationTickResult): void {
  const canvas = useCanvasStore.getState()
  const metrics = useMetricsStore.getState()

  cacheHitsTotal += result.cacheHitsDelta
  cacheMissesTotal += result.cacheMissesDelta

  const cacheNodes = Object.values(canvas.nodes).filter((n) => n.type === 'cache')
  const cacheCount = Math.max(1, cacheNodes.length)
  const hitsRateShare = result.cacheHitsDelta / cacheCount
  const missesRateShare = result.cacheMissesDelta / cacheCount
  const hitsTotalShare = cacheHitsTotal / cacheCount
  const missesTotalShare = cacheMissesTotal / cacheCount
  const linkedCacheByCompute = new Map<string, string>()
  for (const e of Object.values(canvas.edges)) {
    const src = canvas.nodes[e.sourceId]
    const tgt = canvas.nodes[e.targetId]
    if (!src || !tgt) continue
    if (src.type === 'compute' && tgt.type === 'cache') linkedCacheByCompute.set(src.id, tgt.id)
    if (tgt.type === 'compute' && src.type === 'cache') linkedCacheByCompute.set(tgt.id, src.id)
  }

  for (const [id, state] of Object.entries(result.metrics)) {
    const node = canvas.nodes[id]
    if (!node) continue

    totalRequestsByNode[id] =
      (totalRequestsByNode[id] ?? 0) + state.throughputQps

    const podCount = (() => {
      if (node.type === 'compute' || node.type === 'worker') {
        const n = Number(node.config.replicas ?? 1)
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
      }
      if (node.type === 'cache') {
        const n = Number(node.config.replicas ?? 1)
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
      }
      if (node.type === 'database') {
        const n = Number(node.config.readReplicas ?? 0)
        return 1 + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
      }
      return 1
    })()

    const opts: Parameters<typeof simulationStateToMetricsBucket>[2] = {
      totalRequests: totalRequestsByNode[id],
      podCount,
      memoryLimitGb: memoryLimitForNode(node),
    }
    if (node.type === 'cache') {
      opts.cacheHits = hitsRateShare
      opts.cacheMisses = missesRateShare
      opts.cacheHitsLast9m = hitsTotalShare
      opts.cacheMissesLast9m = missesTotalShare
    } else if (node.type === 'compute' && linkedCacheByCompute.has(id)) {
      opts.cacheHits = hitsRateShare
      opts.cacheMisses = missesRateShare
      opts.cacheHitsLast9m = hitsTotalShare
      opts.cacheMissesLast9m = missesTotalShare
    }

    const bucket = simulationStateToMetricsBucket(state, node.type, opts)
    metrics.updateMetrics(id, bucket)

    if (state.errorRate > 0.25) {
      canvas.updateNodeStatus(id, 'degraded')
    } else {
      canvas.updateNodeStatus(id, 'healthy')
    }
  }

  const clientEntry =
    canvas.nodes['client-loadgen'] ??
    Object.values(canvas.nodes).find((n) => n.type === 'client')
  if (clientEntry) {
    const st = result.metrics[clientEntry.id]
    if (st) {
      metrics.setLoadgen({
        active: true,
        currentRps: st.throughputQps,
        targetRps: st.throughputQps,
        totalRequests: Math.round(totalRequestsByNode[clientEntry.id] ?? 0),
        successRate: Math.max(
          0,
          Math.min(100, 100 * (1 - st.errorRate * 0.5))
        ),
        durationSeconds: 0,
        elapsedSeconds: 0,
      })
    }
  }
}

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  running: false,
  paused: false,
  tick: 0,
  loadFactor: 1,
  simulationSpeed: 1,
  error: null,
  lastCacheHitsDelta: 0,
  lastCacheMissesDelta: 0,
  mqQueueDepth: {},
  lastInspector: {},
  lastDiagnostics: [],
  lastTickWallClockMs: null,
  lastEdgeFlows: {},

  start: () => {
    const mode = useCanvasStore.getState().mode
    if (mode !== 'simulate') return

    if (worker) {
      worker.terminate()
      worker = null
    }
    resetAccumulators()
    useMetricsStore.getState().clearMetrics()
    useMetricsStore.getState().setLoadgen(null)

    let w: Worker
    try {
      w = createSimulationWorker()
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Worker failed',
        running: false,
      })
      return
    }

    worker = w

    w.onmessage = (ev: MessageEvent<SimulationWorkerOutMessage>) => {
      const msg = ev.data
      if (msg.type === 'tick') {
        applyTick(msg)
        set({
          tick: msg.tick,
          lastCacheHitsDelta: msg.cacheHitsDelta,
          lastCacheMissesDelta: msg.cacheMissesDelta,
          mqQueueDepth: msg.mqQueueDepth,
          lastInspector: msg.inspector,
          lastDiagnostics: msg.diagnostics,
          lastTickWallClockMs: Date.now(),
          lastEdgeFlows: msg.edgeFlows ?? {},
        })
      }
    }

    w.onerror = () => {
      set({ error: 'Simulation worker error', running: false })
      get().stop()
    }

    const st = useCanvasStore.getState()
    const nodes = Object.values(st.nodes)
    const edges = Object.values(st.edges)
    let profile = workloadProfileForTemplate(st.snapshotTemplateId)
    if (profile) profile = normalizeWorkloadWeights(profile)

    const init: SimulationWorkerInMessage = {
      type: 'init',
      nodes,
      edges,
      workloadProfile: profile,
    }
    w.postMessage(init)
    w.postMessage({ type: 'setLoadFactor', value: get().loadFactor })
    w.postMessage({
      type: 'setSimulationSpeed',
      value: get().simulationSpeed,
    } satisfies SimulationWorkerInMessage)
    w.postMessage({ type: 'start' })

    useCanvasStore.getState().setAllEdgesAnimated(true)

    set({
      running: true,
      paused: false,
      error: null,
      tick: 0,
      lastInspector: {},
      lastDiagnostics: [],
      lastTickWallClockMs: null,
      lastEdgeFlows: {},
    })
  },

  stop: () => {
    if (worker) {
      worker.terminate()
      worker = null
    }
    resetAccumulators()
    const canvas = useCanvasStore.getState()
    canvas.setAllEdgesAnimated(false)
    useMetricsStore.getState().clearMetrics()
    useMetricsStore.getState().setLoadgen(null)
    Object.keys(canvas.nodes).forEach((nid) => {
      canvas.updateNodeStatus(nid, 'idle')
    })
    set({
      running: false,
      paused: false,
      tick: 0,
      lastCacheHitsDelta: 0,
      lastCacheMissesDelta: 0,
      mqQueueDepth: {},
      lastInspector: {},
      lastDiagnostics: [],
      lastTickWallClockMs: null,
      lastEdgeFlows: {},
    })
  },

  pause: () => {
    if (worker) worker.postMessage({ type: 'pause' })
    set({ paused: true })
  },

  resume: () => {
    if (worker) worker.postMessage({ type: 'resume' })
    set({ paused: false })
  },

  setLoadFactor: (v) => {
    const clamped = Math.max(0.05, Math.min(3, v))
    set({ loadFactor: clamped })
    if (worker) {
      worker.postMessage({
        type: 'setLoadFactor',
        value: clamped,
      } satisfies SimulationWorkerInMessage)
    }
  },

  setSimulationSpeed: (v) => {
    const clamped = Math.max(0.25, Math.min(4, v))
    set({ simulationSpeed: clamped })
    if (worker) {
      worker.postMessage({
        type: 'setSimulationSpeed',
        value: clamped,
      } satisfies SimulationWorkerInMessage)
    }
  },

  reinitTopology: (nodes, edges) => {
    if (!worker || !get().running) return
    worker.postMessage({
      type: 'reinit',
      nodes,
      edges,
    } satisfies SimulationWorkerInMessage)
  },
}))
