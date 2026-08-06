import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { cacheHeadlines } from './metricTimeframe'
import { fmtPct, fmtRate } from './format'

/** Spec: CPU/Memory approaching limit. */
export const ALERT_RESOURCE_PCT = 85
/** Spec: cache hit rate dropped. */
export const ALERT_CACHE_HIT_PCT = 50
/** Absolute error rate (/s) treated as a spike in the live inspector. */
export const ALERT_ERROR_RATE_PER_SEC = 10
/** Minimum depth before "growing backlog" alerts fire. */
export const ALERT_QUEUE_DEPTH_MIN = 20
/** Do not re-show the same alert key within this window after dismiss/auto-dismiss. */
export const ALERT_COOLDOWN_MS = 60_000
export const ALERT_AUTO_DISMISS_MS = 8_000
export const ALERT_MAX_VISIBLE = 3

export type InspectorAlertSeverity = 'warning' | 'critical'

export type InspectorAlertKind =
  | 'cpu'
  | 'memory'
  | 'cache_hit'
  | 'queue_backlog'
  | 'error_rate'

export type InspectorAlertCandidate = {
  /** Stable dedupe key: `${nodeId}:${kind}` */
  id: string
  nodeId: string
  kind: InspectorAlertKind
  severity: InspectorAlertSeverity
  title: string
  body: string
}

function displayName(node: CanvasNode): string {
  const label = node.label?.trim()
  if (label) return label
  switch (node.type) {
    case 'compute':
      return 'App Server'
    case 'cache':
      return 'Cache'
    case 'database':
      return 'Database'
    case 'load_balancer':
      return 'Load Balancer'
    case 'message_queue':
      return 'Message Queue'
    case 'worker':
      return 'Worker'
    default:
      return 'Component'
  }
}

function resourceReady(m: MetricsBucket, kind: 'cpu' | 'mem'): boolean {
  if (kind === 'cpu') return !m.cpuIsEstimated && m.cpuPercent > 0
  return !m.memIsEstimated && m.memPercent > 0
}

/**
 * Evaluate live metrics into alert candidates (no cooldown / UI state).
 * Only runs meaningful checks for live-session style buckets.
 */
export function evaluateInspectorAlerts(
  nodes: Record<string, CanvasNode>,
  metrics: Record<string, MetricsBucket>,
): InspectorAlertCandidate[] {
  const out: InspectorAlertCandidate[] = []

  for (const [nodeId, node] of Object.entries(nodes)) {
    const m = metrics[nodeId]
    if (!m) continue
    const name = displayName(node)

    if (
      (node.type === 'compute' ||
        node.type === 'worker' ||
        node.type === 'database' ||
        node.type === 'cache') &&
      resourceReady(m, 'cpu') &&
      m.cpuPercent >= ALERT_RESOURCE_PCT
    ) {
      out.push({
        id: `${nodeId}:cpu`,
        nodeId,
        kind: 'cpu',
        severity: m.cpuPercent >= 95 ? 'critical' : 'warning',
        title: `${name} CPU approaching limit`,
        body: `Utilization is ${fmtPct(m.cpuPercent)}. p99 may degrade.`,
      })
    }

    if (
      (node.type === 'compute' ||
        node.type === 'worker' ||
        node.type === 'database' ||
        node.type === 'cache') &&
      resourceReady(m, 'mem') &&
      m.memPercent >= ALERT_RESOURCE_PCT
    ) {
      out.push({
        id: `${nodeId}:memory`,
        nodeId,
        kind: 'memory',
        severity: m.memPercent >= 95 ? 'critical' : 'warning',
        title: `${name} memory approaching limit`,
        body: `Utilization is ${fmtPct(m.memPercent)}. Evictions or OOM risk may rise.`,
      })
    }

    if (node.type === 'cache') {
      const head = cacheHeadlines(m, 'live', fmtRate)
      const traffic = (m.cacheHits ?? 0) + (m.cacheMisses ?? 0) > 0
      if (
        traffic &&
        head.hitRatePct != null &&
        head.hitRatePct < ALERT_CACHE_HIT_PCT
      ) {
        out.push({
          id: `${nodeId}:cache_hit`,
          nodeId,
          kind: 'cache_hit',
          severity: 'warning',
          title: `${name} hit rate dropped to ${fmtPct(head.hitRatePct)}`,
          body: 'DB read load increasing.',
        })
      }
    }

    if (node.type === 'message_queue') {
      const produce = m.produceRate ?? 0
      const consume = m.consumeRate ?? 0
      const depth = m.queueDepth ?? 0
      if (
        depth >= ALERT_QUEUE_DEPTH_MIN &&
        produce > consume &&
        consume >= 0
      ) {
        out.push({
          id: `${nodeId}:queue_backlog`,
          nodeId,
          kind: 'queue_backlog',
          severity: 'warning',
          title: `${name} depth growing`,
          body: 'Consumer may be falling behind.',
        })
      }
    }

    if (node.type === 'compute') {
      const err = m.errorRate ?? 0
      if (err >= ALERT_ERROR_RATE_PER_SEC) {
        out.push({
          id: `${nodeId}:error_rate`,
          nodeId,
          kind: 'error_rate',
          severity: 'critical',
          title: `${name} error rate spiked to ${fmtRate(err)}/s`,
          body: 'Check logs and downstream dependencies.',
        })
      }
    }
  }

  return out
}

/** Apply cooldown + max-visible to merge candidates into the active toast list. */
export function mergeAlertCandidates(opts: {
  candidates: InspectorAlertCandidate[]
  activeIds: string[]
  cooldownUntil: Record<string, number>
  now: number
  maxVisible?: number
}): InspectorAlertCandidate[] {
  const max = opts.maxVisible ?? ALERT_MAX_VISIBLE
  const activeSet = new Set(opts.activeIds)
  const kept = opts.candidates.filter((c) => activeSet.has(c.id))
  const additions: InspectorAlertCandidate[] = []

  for (const c of opts.candidates) {
    if (activeSet.has(c.id)) continue
    const until = opts.cooldownUntil[c.id] ?? 0
    if (opts.now < until) continue
    additions.push(c)
  }

  return [...kept, ...additions].slice(0, max)
}
