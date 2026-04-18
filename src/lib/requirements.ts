import type { CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'
import type { SimNodeInspector } from './simulation/types'
import type { SystemAggregates } from './systemMetrics'

export type RequirementStatus = 'pass' | 'partial' | 'fail'

export interface RequirementDef {
  id: string
  category: 'functional' | 'non-functional'
  label: string
  description: string
  /** Relative weight for letter grade (sum normalized). */
  weight: number
  evaluate: (ctx: RequirementsContext) => {
    status: RequirementStatus
    detail: string
  }
}

export interface RequirementsContext {
  metrics: Record<string, MetricsBucket>
  nodes: Record<string, CanvasNode>
  inspector: Record<string, SimNodeInspector>
  aggregates: SystemAggregates | null
  mode: 'live' | 'simulate'
}

function countByType(
  nodes: Record<string, CanvasNode>,
  type: CanvasNode['type']
): number {
  return Object.values(nodes).filter((n) => n.type === type).length
}

function anyDatabase(nodes: Record<string, CanvasNode>): boolean {
  return countByType(nodes, 'database') > 0
}

function anyCache(nodes: Record<string, CanvasNode>): boolean {
  return countByType(nodes, 'cache') > 0
}

function anyLoadBalancer(nodes: Record<string, CanvasNode>): boolean {
  return countByType(nodes, 'load_balancer') > 0
}

function cacheHitRate(metrics: Record<string, MetricsBucket>): number | null {
  let hits = 0
  let misses = 0
  for (const [id, m] of Object.entries(metrics)) {
    void id
    const h = m.cacheHits ?? 0
    const miss = m.cacheMisses ?? 0
    if (h + miss > 0) {
      hits += h
      misses += miss
    }
  }
  const t = hits + misses
  return t > 0 ? hits / t : null
}

function worstDbErrorRate(
  metrics: Record<string, MetricsBucket>,
  nodes: Record<string, CanvasNode>
): number {
  let max = 0
  for (const [id, m] of Object.entries(metrics)) {
    if (nodes[id]?.type === 'database') {
      max = Math.max(max, m.errorRate ?? 0)
    }
  }
  return max
}

function computeHealthyCompute(
  metrics: Record<string, MetricsBucket>,
  nodes: Record<string, CanvasNode>
): { count: number; unhealthy: number } {
  let count = 0
  let unhealthy = 0
  for (const [id, n] of Object.entries(nodes)) {
    if (n.type !== 'compute') continue
    count += 1
    const m = metrics[id]
    if (m && (m.errorRate ?? 0) > 0.2) unhealthy += 1
  }
  return { count, unhealthy }
}

const statusScore: Record<RequirementStatus, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
}

export function letterFromPercent(pct: number): string {
  if (pct >= 93) return 'A'
  if (pct >= 87) return 'B+'
  if (pct >= 80) return 'B'
  if (pct >= 73) return 'C+'
  if (pct >= 65) return 'C'
  if (pct >= 55) return 'D'
  return 'F'
}

export function requirementsForTemplate(
  templateId: string | null | undefined
): RequirementDef[] {
  if (!templateId) return []
  return REQUIREMENTS_BY_TEMPLATE[templateId] ?? []
}

export interface RequirementResult {
  def: RequirementDef
  status: RequirementStatus
  detail: string
}

export function evaluateRequirements(
  templateId: string | null | undefined,
  ctx: RequirementsContext
): {
  results: RequirementResult[]
  scorePercent: number
  letter: string
} | null {
  const defs = requirementsForTemplate(templateId)
  if (defs.length === 0) return null

  const results: RequirementResult[] = defs.map((def) => {
    const { status, detail } = def.evaluate(ctx)
    return { def, status, detail }
  })

  let weighted = 0
  let wSum = 0
  for (const r of results) {
    const w = Math.max(0, r.def.weight)
    wSum += w
    weighted += w * statusScore[r.status]
  }
  const scorePercent = wSum > 0 ? Math.round((weighted / wSum) * 100) : 0
  const letter = letterFromPercent(scorePercent)

  return { results, scorePercent, letter }
}

/** URL shortener rubric (aligned with common interview framing). */
const urlShortenerRequirements: RequirementDef[] = [
  {
    id: 'uniq-db',
    category: 'functional',
    label: 'Short codes backed by store',
    description:
      'A database is the source of truth for uniqueness; should stay healthy under load.',
    weight: 1,
    evaluate: ({ nodes, metrics }) => {
      if (!anyDatabase(nodes)) {
        return {
          status: 'fail',
          detail: 'No database in the design — cannot guarantee unique codes.',
        }
      }
      const err = worstDbErrorRate(metrics, nodes)
      if (err > 0.25) {
        return {
          status: 'fail',
          detail: `Database error pressure high (~${(err * 100).toFixed(0)}%) — risk to writes/reads.`,
        }
      }
      if (err > 0.08) {
        return {
          status: 'partial',
          detail: 'Database under stress; uniqueness path may be slower or flaky.',
        }
      }
      return {
        status: 'pass',
        detail: 'Database present and stable enough for uniqueness guarantees.',
      }
    },
  },
  {
    id: 'redirect-latency',
    category: 'functional',
    label: 'Redirect path latency',
    description: 'Redirects should feel fast (target under 100ms p99 at the stack).',
    weight: 1.2,
    evaluate: ({ aggregates }) => {
      if (!aggregates?.hasComponentMetrics) {
        return { status: 'partial', detail: 'No metrics yet — start load or simulation.' }
      }
      const p99 = aggregates.systemP99Ms
      if (p99 <= 0) {
        return { status: 'partial', detail: 'Latency not reported yet.' }
      }
      if (p99 <= 100) {
        return { status: 'pass', detail: `Worst-hop p99 is ${Math.round(p99)}ms — within a tight redirect budget.` }
      }
      if (p99 <= 220) {
        return {
          status: 'partial',
          detail: `Worst-hop p99 is ${Math.round(p99)}ms — above a strict 100ms bar but not catastrophic.`,
        }
      }
      return {
        status: 'fail',
        detail: `Worst-hop p99 is ${Math.round(p99)}ms — redirect SLO likely missed.`,
      }
    },
  },
  {
    id: 'app-tier',
    category: 'functional',
    label: 'App tier for shorten + redirect',
    description: 'At least one healthy app server to run business logic.',
    weight: 0.8,
    evaluate: ({ nodes, metrics }) => {
      const { count, unhealthy } = computeHealthyCompute(metrics, nodes)
      if (count === 0) {
        return { status: 'fail', detail: 'No app server — cannot serve shorten or redirect APIs.' }
      }
      if (unhealthy === count) {
        return { status: 'fail', detail: 'All app servers look overloaded or failing.' }
      }
      if (unhealthy > 0) {
        return {
          status: 'partial',
          detail: `${unhealthy} of ${count} app servers degraded — partial capacity.`,
        }
      }
      return { status: 'pass', detail: `${count} app server(s) reporting within healthy error bounds.` }
    },
  },
  {
    id: 'availability',
    category: 'non-functional',
    label: 'Availability / error budget',
    description: 'Very low weighted error rate across the stack (proxy for 99.99% style SLOs).',
    weight: 1,
    evaluate: ({ aggregates }) => {
      if (!aggregates?.hasComponentMetrics) {
        return { status: 'partial', detail: 'No metrics yet.' }
      }
      const e = aggregates.systemErrorRate
      const pct = e * 100
      if (pct <= 0.05) {
        return { status: 'pass', detail: `Weighted errors ~${pct.toFixed(2)}% — very clean.` }
      }
      if (pct <= 0.5) {
        return {
          status: 'partial',
          detail: `Weighted errors ~${pct.toFixed(2)}% — acceptable for a lab run, not “four nines”.`,
        }
      }
      return {
        status: 'fail',
        detail: `Weighted errors ~${pct.toFixed(2)}% — user-visible failure rate is high.`,
      }
    },
  },
  {
    id: 'cache-read-skew',
    category: 'non-functional',
    label: 'Read-heavy path & cache',
    description: 'URL shorteners are read-skewed; cache protects the database.',
    weight: 1,
    evaluate: ({ nodes, metrics }) => {
      if (!anyCache(nodes)) {
        return {
          status: 'partial',
          detail: 'No cache — design can work, but misses read-heavy optimization from the template story.',
        }
      }
      const hr = cacheHitRate(metrics)
      if (hr == null) {
        return {
          status: 'partial',
          detail: 'Cache present; hit rate not visible yet (run traffic).',
        }
      }
      const pct = hr * 100
      if (pct >= 80) {
        return { status: 'pass', detail: `Hit rate ~${pct.toFixed(0)}% — cache is doing its job.` }
      }
      if (pct >= 50) {
        return {
          status: 'partial',
          detail: `Hit rate ~${pct.toFixed(0)}% — some relief for the DB, room to tune.`,
        }
      }
      return {
        status: 'fail',
        detail: `Hit rate ~${pct.toFixed(0)}% — most reads may still hit the database.`,
      }
    },
  },
  {
    id: 'scale-shape',
    category: 'non-functional',
    label: 'Horizontal scale shape',
    description: 'Load balancer + multiple app replicas for throughput headroom.',
    weight: 0.7,
    evaluate: ({ nodes }) => {
      const lb = anyLoadBalancer(nodes)
      const apps = countByType(nodes, 'compute')
      if (!lb && apps <= 1) {
        return {
          status: 'partial',
          detail: 'Single app path without LB — fine for a toy, limited for scale-out story.',
        }
      }
      if (lb && apps >= 2) {
        return {
          status: 'pass',
          detail: 'LB with ≥2 app servers — matches a scale-out redirect tier.',
        }
      }
      if (lb) {
        return {
          status: 'partial',
          detail: 'LB present but only one app server — add replicas for real headroom.',
        }
      }
      return {
        status: 'partial',
        detail: `${apps} app server(s) without LB — client would need another way to spread load.`,
      }
    },
  },
]

/** Lighter rubrics for other templates until we add interview-specific copy. */
const genericScaleRequirements: RequirementDef[] = [
  {
    id: 'latency',
    category: 'non-functional',
    label: 'Latency',
    description: 'Worst-hop p99 stays within a reasonable interactive range.',
    weight: 1,
    evaluate: ({ aggregates }) => {
      if (!aggregates?.hasComponentMetrics) {
        return { status: 'partial', detail: 'No metrics yet.' }
      }
      const p99 = aggregates.systemP99Ms
      if (p99 <= 0) return { status: 'partial', detail: 'Latency not reported.' }
      if (p99 <= 150) return { status: 'pass', detail: `p99 ~${Math.round(p99)}ms.` }
      if (p99 <= 400) {
        return { status: 'partial', detail: `p99 ~${Math.round(p99)}ms — tail is heavy.` }
      }
      return { status: 'fail', detail: `p99 ~${Math.round(p99)}ms — likely poor UX.` }
    },
  },
  {
    id: 'errors',
    category: 'non-functional',
    label: 'Stability',
    description: 'Low weighted error rate across components.',
    weight: 1,
    evaluate: ({ aggregates }) => {
      if (!aggregates?.hasComponentMetrics) return { status: 'partial', detail: 'No metrics yet.' }
      const pct = aggregates.systemErrorRate * 100
      if (pct <= 0.2) return { status: 'pass', detail: `Errors ~${pct.toFixed(2)}%.` }
      if (pct <= 2) return { status: 'partial', detail: `Errors ~${pct.toFixed(2)}%.` }
      return { status: 'fail', detail: `Errors ~${pct.toFixed(2)}%.` }
    },
  },
  {
    id: 'data-tier',
    category: 'functional',
    label: 'Data tier',
    description: 'Database present for durable state.',
    weight: 0.8,
    evaluate: ({ nodes, metrics }) => {
      if (!anyDatabase(nodes)) {
        return { status: 'fail', detail: 'No database in the canvas.' }
      }
      const err = worstDbErrorRate(metrics, nodes)
      if (err > 0.2) return { status: 'fail', detail: 'Database looks unhealthy.' }
      if (err > 0.05) return { status: 'partial', detail: 'Database under some pressure.' }
      return { status: 'pass', detail: 'Database present and stable.' }
    },
  },
  {
    id: 'lb-apps',
    category: 'non-functional',
    label: 'Ingress distribution',
    description: 'Load balancer in front of app tier when scaling out.',
    weight: 0.6,
    evaluate: ({ nodes }) => {
      const lb = anyLoadBalancer(nodes)
      const apps = countByType(nodes, 'compute')
      if (apps === 0) return { status: 'fail', detail: 'No app servers.' }
      if (lb && apps >= 1) return { status: 'pass', detail: 'LB fronts the app tier.' }
      return { status: 'partial', detail: 'Consider an LB when you add replicas.' }
    },
  },
]

const REQUIREMENTS_BY_TEMPLATE: Record<string, RequirementDef[]> = {
  'url-shortener': urlShortenerRequirements,
  ecommerce: genericScaleRequirements,
  'social-feed': genericScaleRequirements,
}
