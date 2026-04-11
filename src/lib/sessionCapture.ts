import { clearLiveSessionPersist } from './liveSessionStorage'
import { fmtMemMB, fmtPct } from './format'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'
import { useCanvasStore, type SessionSummary } from '../store/canvasStore'
import { useLogStore } from '../store/logStore'
import { useMetricsStore, type MetricsBucket } from '../store/metricsStore'

function resourceSummaryLines(
  latest: MetricsBucket | undefined,
  cpuPeakPct: number,
  memPeakPct: number,
  memBytesPeak: number
): { cpu: string; mem: string } {
  if (!latest) {
    return {
      cpu: fmtPct(cpuPeakPct),
      mem:
        memPeakPct > 0 ? fmtPct(memPeakPct) : fmtMemMB(memBytesPeak),
    }
  }
  const cpu = latest.cpuIsEstimated ? 'Allocated' : fmtPct(cpuPeakPct)
  let mem: string
  if (latest.memIsEstimated) {
    mem = 'Allocated'
  } else if (latest.memoryLimit > 0) {
    mem = fmtPct(memPeakPct)
  } else {
    mem = fmtMemMB(memBytesPeak > 0 ? memBytesPeak : latest.memoryBytes)
  }
  return { cpu, mem }
}

function buildSessionSummaryFromMetrics(): SessionSummary {
  const st = useCanvasStore.getState()
  const metricsState = useMetricsStore.getState()
  const allMetrics = metricsState.metrics
  const allHistory = metricsState.history

  let peakRps = 0
  let peakP99 = 0
  let totalReqs = 0
  let avgLat = 0
  let totalHits = 0
  let totalMisses = 0
  let maxErrorRate = 0

  const componentSummaries: SessionSummary['componentSummaries'] = {}

  for (const [nodeId, buckets] of Object.entries(allHistory)) {
    const node = st.nodes[nodeId]
    if (!node || node.type === 'client') continue
    let cpuPeak = 0
    let memPeak = 0
    let memBytesPeak = 0
    let maxRps = 0
    for (const b of buckets) {
      cpuPeak = Math.max(cpuPeak, b.cpuPercent)
      memPeak = Math.max(memPeak, b.memPercent)
      memBytesPeak = Math.max(memBytesPeak, b.memoryBytes)
      maxRps = Math.max(maxRps, b.requestRate)
      peakRps = Math.max(peakRps, b.requestRate)
      peakP99 = Math.max(peakP99, b.p99Latency)
    }
    const latest = allMetrics[nodeId]
    if (latest) {
      totalReqs = Math.max(totalReqs, latest.totalRequests)
      totalHits = Math.max(totalHits, latest.cacheHits)
      totalMisses = Math.max(totalMisses, latest.cacheMisses)
      avgLat = Math.max(avgLat, latest.avgLatency)
      maxErrorRate = Math.max(maxErrorRate, latest.errorRate)
    }
    const { cpu, mem } = resourceSummaryLines(
      latest,
      cpuPeak,
      memPeak,
      memBytesPeak
    )
    componentSummaries[nodeId] = {
      type: node.type,
      label: node.label,
      cpuSummary: cpu,
      memSummary: mem,
      requestRate: maxRps,
    }
  }

  for (const nodeId of Object.keys(st.nodes)) {
    if (componentSummaries[nodeId]) continue
    const latest = allMetrics[nodeId]
    const node = st.nodes[nodeId]
    if (!latest || !node || node.type === 'client') continue
    const { cpu, mem } = resourceSummaryLines(
      latest,
      latest.cpuPercent,
      latest.memPercent,
      latest.memoryBytes
    )
    componentSummaries[nodeId] = {
      type: node.type,
      label: node.label,
      cpuSummary: cpu,
      memSummary: mem,
      requestRate: latest.requestRate,
    }
    peakRps = Math.max(peakRps, latest.requestRate)
    peakP99 = Math.max(peakP99, latest.p99Latency)
    totalReqs = Math.max(totalReqs, latest.totalRequests)
    totalHits = Math.max(totalHits, latest.cacheHits)
    totalMisses = Math.max(totalMisses, latest.cacheMisses)
    avgLat = Math.max(avgLat, latest.avgLatency)
    maxErrorRate = Math.max(maxErrorRate, latest.errorRate)
  }

  const cacheTotal = totalHits + totalMisses
  const cacheHitRate = cacheTotal > 0 ? (totalHits / cacheTotal) * 100 : 0

  const sessionEnd = Date.now()
  const sessionStart = st.liveSessionEndsAt
    ? st.liveSessionEndsAt - 9 * 60 * 1000
    : sessionEnd - 60_000
  const durationSec = Math.max(0, Math.round((sessionEnd - sessionStart) / 1000))
  const durationStr = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`

  return {
    template: st.snapshotTemplateId ?? 'custom',
    duration: durationStr,
    peakRps,
    peakP99,
    totalRequests: Math.round(totalReqs),
    cacheHitRate,
    avgLatency: avgLat,
    errorRate: maxErrorRate,
    componentSummaries,
  }
}

/** Idempotent: skips if a summary is already set (timer vs WS vs manual). */
export function captureSessionSummary(): void {
  const st = useCanvasStore.getState()
  if (st.sessionSummary != null) return
  st.setSessionSummary(buildSessionSummaryFromMetrics())
}

/**
 * Live session ended without the user clicking Teardown (timer, or metrics WS
 * gave up). Does not call the delete deployment API — backend may already have
 * torn the namespace down.
 */
export function exitLiveSessionDueToRemoteEnd(): void {
  const st = useCanvasStore.getState()
  if (st.mode !== 'live') return

  if (st.nodes[CLIENT_LOADGEN_ID]) {
    st.removeNode(CLIENT_LOADGEN_ID)
  }
  captureSessionSummary()

  const s = useCanvasStore.getState()
  s.setMode('design')
  s.setDeploymentId(null)
  s.setLiveSessionEndsAt(null)
  s.setAllEdgesAnimated(false)
  useMetricsStore.getState().clearMetrics()
  useLogStore.getState().clearLogs()
  const nodes = useCanvasStore.getState().nodes
  Object.keys(nodes).forEach((nid) => {
    useCanvasStore.getState().updateNodeStatus(nid, 'idle')
  })
  clearLiveSessionPersist()
}
