import { CLIENT_LOADGEN_ID } from './spawnClientNode'
import type { CanvasNode } from '../store/canvasStore'
import type { LiveLoadgenState, MetricsBucket } from '../store/metricsStore'
import type { SimNodeInspector } from './simulation/types'

export interface SystemAggregates {
  /** Worst p99 among non-client components (ms). */
  systemP99Ms: number
  /** Request-weighted mean error rate in 0–1 across non-client components. */
  systemErrorRate: number
  /** Ingress / client-facing throughput (rps). */
  throughputRps: number
  /** True when any non-client metric bucket exists. */
  hasComponentMetrics: boolean
}

function isClientNode(
  nodes: Record<string, CanvasNode>,
  nodeId: string
): boolean {
  return nodes[nodeId]?.type === 'client'
}

/**
 * Live: prefer loadgen RPS when active; else client node requestRate.
 * Simulate: client metrics.requestRate or inspector servedQps.
 */
export function computeThroughputRps(
  metrics: Record<string, MetricsBucket>,
  nodes: Record<string, CanvasNode>,
  loadgen: LiveLoadgenState | null,
  mode: 'live' | 'simulate',
  lastInspector: Record<string, SimNodeInspector>,
  simRunning: boolean
): number {
  if (mode === 'live' && loadgen?.active && (loadgen.currentRps ?? 0) > 0) {
    return loadgen.currentRps
  }
  const clientBucket = metrics[CLIENT_LOADGEN_ID]
  if (clientBucket && (clientBucket.requestRate ?? 0) > 0) {
    return clientBucket.requestRate
  }
  const clientIds = Object.keys(nodes).filter((id) => nodes[id]?.type === 'client')
  for (const id of clientIds) {
    const m = metrics[id]
    if (m && (m.requestRate ?? 0) > 0) return m.requestRate
    if (mode === 'simulate' && simRunning) {
      const ins = lastInspector[id]
      const q = ins?.servedQps ?? ins?.ingressQps
      if (q != null && q > 0) return q
    }
  }
  if (mode === 'simulate' && simRunning) {
    let best = 0
    for (const [id, ins] of Object.entries(lastInspector)) {
      if (nodes[id]?.type === 'client') continue
      const q = Math.max(ins?.ingressQps ?? 0, ins?.servedQps ?? 0)
      if (q > best) best = q
    }
    if (best > 0) return best
  }
  return 0
}

export function computeSystemAggregates(
  metrics: Record<string, MetricsBucket>,
  nodes: Record<string, CanvasNode>,
  loadgen: LiveLoadgenState | null,
  mode: 'live' | 'simulate',
  lastInspector: Record<string, SimNodeInspector>,
  simRunning: boolean
): SystemAggregates {
  let systemP99Ms = 0
  let weightedErr = 0
  let weightSum = 0
  let countNonClient = 0
  let sumErrUnweighted = 0

  for (const [nodeId, m] of Object.entries(metrics)) {
    if (isClientNode(nodes, nodeId)) continue
    countNonClient += 1
    systemP99Ms = Math.max(systemP99Ms, m.p99Latency ?? 0)
    const w = Math.max(0, m.requestRate ?? 0)
    const e = Math.max(0, m.errorRate ?? 0)
    if (w > 0) {
      weightedErr += e * w
      weightSum += w
    }
    sumErrUnweighted += e
  }

  const systemErrorRate =
    weightSum > 0
      ? weightedErr / weightSum
      : countNonClient > 0
        ? sumErrUnweighted / countNonClient
        : 0

  const throughputRps = computeThroughputRps(
    metrics,
    nodes,
    loadgen,
    mode,
    lastInspector,
    simRunning
  )

  return {
    systemP99Ms,
    systemErrorRate,
    throughputRps,
    hasComponentMetrics: countNonClient > 0,
  }
}
