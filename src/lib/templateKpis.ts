import type { TopologyFlags } from './componentRole'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { LiveLoadgenState, MetricsBucket } from '../editor-core/stores/metricsStore'
import type { SimNodeInspector } from '../editor-core/domain/simulation/types'
import { FMT_EMPTY, fmtInt, fmtMs, fmtRate } from './format'
import { readWriteFractions } from '../editor-core/domain/simulation/workload'
import { workloadProfileForTemplate } from '../editor-core/domain/simulation/workloadProfiles'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'
import {
  groupTemplateMetricDistributions,
  isConventionMetricKey,
  metricPrefixCopy,
  type TemplateMetricDistribution,
} from './templateMetricDistributions'

export interface TemplateKpi {
  id: string
  label: string
  compute(
    metrics: Record<string, MetricsBucket>,
    inspector: Record<string, SimNodeInspector>,
    nodes: Record<string, CanvasNode>,
    loadgen: LiveLoadgenState | null
  ): number | null
  format(v: number): string
}

function ingressTotalRequests(
  metrics: Record<string, MetricsBucket>,
  loadgen: LiveLoadgenState | null
): number {
  const fromLg = loadgen?.totalRequests ?? 0
  if (fromLg > 0) return Math.round(fromLg)
  const c = metrics[CLIENT_LOADGEN_ID]?.totalRequests ?? 0
  if (c > 0) return Math.round(c)
  let max = 0
  for (const m of Object.values(metrics)) {
    if ((m.totalRequests ?? 0) > max) max = m.totalRequests ?? 0
  }
  return Math.round(max)
}

function writeShare(templateId: string | null | undefined): number {
  const p = workloadProfileForTemplate(templateId)
  if (!p?.archetypes.length) return 0.05
  return readWriteFractions(p).write
}

const urlShortenerKpis: TemplateKpi[] = [
  {
    id: 'urls-shortened',
    label: 'URLs shortened (est.)',
    compute: (metrics, _insp, _nodes, loadgen) => {
      const total = ingressTotalRequests(metrics, loadgen)
      const w = writeShare('url-shortener')
      return Math.max(0, Math.floor(total * w))
    },
    format: (v) => fmtInt(v),
  },
]

/** Shown when the template has no matching `templateMetrics` key yet. */
const TELEMETRY_PENDING = FMT_EMPTY

const ecommerceKpis: TemplateKpi[] = [
  {
    id: 'orders',
    label: 'Orders / writes (est.)',
    compute: (metrics, _insp, _nodes, loadgen) => {
      const total = ingressTotalRequests(metrics, loadgen)
      return Math.max(0, Math.floor(total * writeShare('ecommerce')))
    },
    format: (v) => fmtInt(v),
  },
]

function socialKpisFor(templateId: 'social-feed' | 'social-feed-pull'): TemplateKpi[] {
  const profileId = templateId === 'social-feed-pull' ? 'social-feed' : templateId
  return [
    {
      id: 'posts',
      label: 'Posts / writes (est.)',
      compute: (metrics, _insp, _nodes, loadgen) => {
        const total = ingressTotalRequests(metrics, loadgen)
        return Math.max(0, Math.floor(total * writeShare(profileId)))
      },
      format: (v) => fmtInt(v),
    },
  ]
}

const socialKpis = socialKpisFor('social-feed')
const socialPullKpis = socialKpisFor('social-feed-pull')

function isSocialFeedTemplate(templateId: string): boolean {
  return templateId === 'social-feed' || templateId === 'social-feed-pull'
}

function tmFinite(tm: Record<string, number>, key: string): boolean {
  const v = tm[key]
  return v != null && Number.isFinite(v)
}

function preferEcommerceCheckoutTotals(tm: Record<string, number>): boolean {
  return tmFinite(tm, 'checkout.sync_total') || tmFinite(tm, 'checkout.async_total')
}

function preferSocialPostTotals(tm: Record<string, number>): boolean {
  return tmFinite(tm, 'posts.total_sync') || tmFinite(tm, 'posts.total_async')
}

export const TEMPLATE_KPIS: Record<string, TemplateKpi[]> = {
  'url-shortener': urlShortenerKpis,
  ecommerce: ecommerceKpis,
  'social-feed': socialKpis,
  'social-feed-pull': socialPullKpis,
}

/** Optional rows merged from backend `templateMetrics` (see ganymede `collectTemplateMetrics`). */
const TEMPLATE_METRIC_ROWS: Record<
  string,
  Array<{ key: string; label: string; format: (n: number) => string }>
> = {
  'social-feed': [
    {
      key: 'feed.push_total',
      label: 'Feed reads (push)',
      format: (n) => fmtInt(Math.round(n)),
    },
    { key: 'worker.processed', label: 'Fan-out jobs done', format: (n) => fmtInt(Math.round(n)) },
    { key: 'worker.errors', label: 'Fan-out errors', format: (n) => fmtInt(Math.round(n)) },
    {
      key: 'worker.fanout_p99',
      label: 'Fan-out p99',
      format: (n) => (n >= 10 ? fmtInt(Math.round(n)) : n.toFixed(2)),
    },
    { key: 'mq.publish_total', label: 'Messages published', format: (n) => fmtInt(Math.round(n)) },
  ],
  'social-feed-pull': [
    { key: 'posts.total_sync', label: 'Posts written (sync)', format: (n) => fmtInt(Math.round(n)) },
  ],
  ecommerce: [
    {
      key: 'checkout.inventory_conflicts',
      label: 'Inventory conflicts',
      format: (n) => fmtInt(Math.round(n)),
    },
    { key: 'mq.publish_errors', label: 'Publish failures', format: (n) => fmtInt(Math.round(n)) },
    { key: 'mq.publish_total', label: 'Messages published', format: (n) => fmtInt(Math.round(n)) },
  ],
  'ticket-drop': [
    { key: 'ticket.sold', label: 'Tickets sold', format: (n) => fmtInt(Math.round(n)) },
    { key: 'ticket.capacity', label: 'Event capacity', format: (n) => fmtInt(Math.round(n)) },
    {
      key: 'ticket.oversell',
      label: 'Oversell (DB truth)',
      format: (n) => fmtInt(Math.round(n)),
    },
  ],
}

export interface TemplateKpiRow {
  id: string
  label: string
  value: string
  kind?: 'error'
  numeric?: number
  /** Live HUD chip text; defaults to a shortened `label`. */
  hudLabel?: string
}

export function kpiKindFromText(id: string, label: string): TemplateKpiRow['kind'] {
  const s = `${id} ${label}`.toLowerCase()
  if (/error|fail|conflict|collision|oversell/.test(s)) return 'error'
  return undefined
}

/** Error-type chips go red only when the numeric value is greater than zero. */
export function kpiChipIsAlert(row: TemplateKpiRow): boolean {
  if (row.kind !== 'error') return false
  if (typeof row.numeric === 'number' && Number.isFinite(row.numeric)) {
    return row.numeric > 0
  }
  const n = Number(String(row.value).replace(/[^0-9.+-]/g, ''))
  return Number.isFinite(n) && n > 0
}

/** Live HUD only: short labels, not inspector sentence names. */
export const HUD_KPI_MAX = 4

const HUD_LABEL_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^posts written/i, 'Posts'],
  [/^feed reads/i, 'Feed reads'],
  [/^fan-out jobs/i, 'Fan-out'],
  [/^fan-out errors/i, 'Fan-out errors'],
  [/^fan-out p99/i, 'Fan-out p99'],
  [/^messages published/i, 'Published'],
  [/^urls shortened/i, 'Shortens'],
  [/^checkouts written/i, 'Checkouts'],
  [/^inventory conflicts/i, 'Conflicts'],
  [/^oversell/i, 'Oversell'],
  [/^tickets sold/i, 'Sold'],
  [/^event capacity/i, 'Capacity'],
  [/^collisions/i, 'Collisions'],
]

export function hudKpiLabel(label: string): string {
  const stripped = label.replace(/\s*\((?:async|sync|push|pull)\)/gi, '').trim()
  for (const [re, short] of HUD_LABEL_RULES) {
    if (re.test(stripped)) return short
  }
  if (stripped.length > 18) return `${stripped.slice(0, 16)}…`
  return stripped
}

/** Error-first, short labels, hard cap for the live HUD. */
export function hudKpiRows(
  rows: TemplateKpiRow[],
  max = HUD_KPI_MAX,
): TemplateKpiRow[] {
  const alerts = rows.filter((r) => kpiChipIsAlert(r))
  const rest = rows.filter((r) => !kpiChipIsAlert(r))
  const out: TemplateKpiRow[] = []
  const seen = new Set<string>()
  for (const row of [...alerts, ...rest]) {
    const label = row.hudLabel ?? hudKpiLabel(row.label)
    if (seen.has(label)) continue
    seen.add(label)
    out.push({ ...row, label })
    if (out.length >= max) break
  }
  return out
}

function kpiRow(
  id: string,
  label: string,
  value: string,
  numeric?: number,
  hudLabel?: string,
): TemplateKpiRow {
  return {
    id,
    label,
    value,
    numeric,
    hudLabel,
    kind: kpiKindFromText(id, label),
  }
}

export function isMetricRelevant(
  templateId: string,
  key: string,
  topology: TopologyFlags | undefined,
): boolean {
  if (!topology) return true

  const { hasMQ, hasWorker, hasCache } = topology
  if (templateId === 'social-feed-pull') {
    if (key.startsWith('feed.push')) return false
    if (key.includes('async') || key.startsWith('worker.') || key.startsWith('mq.')) {
      return false
    }
    if (key === 'posts.total_async') return false
    return true
  }
  if (templateId === 'social-feed') {
    if (!hasMQ && (key.includes('async') || key.includes('worker') || key.includes('mq.'))) {
      return false
    }
    if (hasMQ && key === 'posts.total_sync') return false
    if (!hasMQ && key === 'posts.total_async') return false
    if (!hasCache && key.startsWith('feed.push')) return false
    if (hasCache && hasMQ && key.startsWith('feed.pull')) return false
    if (!hasWorker && key.startsWith('worker.')) return false
  }
  if (templateId === 'ecommerce') {
    if (!hasMQ && (key.includes('async') || key.startsWith('mq.'))) return false
    if (hasMQ && key === 'checkout.sync_total') return false
    if (!hasMQ && key === 'checkout.async_total') return false
    if (hasMQ && key === 'checkout.sync_p95') return false
    if (!hasMQ && key === 'checkout.async_p95') return false
  }
  return true
}

function distributionIsRelevant(
  templateId: string,
  dist: TemplateMetricDistribution,
  topology: TopologyFlags | undefined,
): boolean {
  const keys = [
    `${dist.prefix}_rate`,
    `${dist.prefix}_p50`,
    `${dist.prefix}_p95`,
    `${dist.prefix}_p99`,
  ]
  return keys.some((key) => isMetricRelevant(templateId, key, topology))
}

function conventionKpiRows(
  templateId: string,
  templateMetrics: Record<string, number>,
  topology?: TopologyFlags,
): TemplateKpiRow[] {
  const rows: TemplateKpiRow[] = []
  for (const dist of groupTemplateMetricDistributions(templateMetrics)) {
    if (!distributionIsRelevant(templateId, dist, topology)) continue

    const copy = metricPrefixCopy(dist.prefix)
    const rateKey = `${dist.prefix}_rate`
    if (dist.rate != null && dist.rate > 0 && isMetricRelevant(templateId, rateKey, topology)) {
      rows.push(
        kpiRow(
          `tm-${rateKey}`,
          `${copy.label} · reads/s`,
          `${fmtRate(dist.rate)}/s`,
          dist.rate,
          copy.hudRate,
        ),
      )
    }

    const p95Key = `${dist.prefix}_p95`
    if (
      dist.p95Ms != null &&
      dist.p95Ms > 0 &&
      isMetricRelevant(templateId, p95Key, topology)
    ) {
      rows.push(
        kpiRow(
          `tm-${p95Key}`,
          `${copy.label} · p95`,
          fmtMs(dist.p95Ms),
          dist.p95Ms,
          copy.hudP95,
        ),
      )
      continue
    }

    const p99Key = `${dist.prefix}_p99`
    if (
      dist.p99Ms != null &&
      dist.p99Ms > 0 &&
      isMetricRelevant(templateId, p99Key, topology)
    ) {
      rows.push(
        kpiRow(
          `tm-${p99Key}`,
          `${copy.label} · p99`,
          fmtMs(dist.p99Ms),
          dist.p99Ms,
          copy.hudP99,
        ),
      )
    }
  }
  return rows
}

/** Journey KPIs in the live chip strip (3-8; metrics-component-panels §2.7). */
const MAX_TEMPLATE_KPI_ROWS = 8

export function templateKpiRows(
  templateId: string | null | undefined,
  metrics: Record<string, MetricsBucket>,
  inspector: Record<string, SimNodeInspector>,
  nodes: Record<string, CanvasNode>,
  loadgen: LiveLoadgenState | null,
  templateMetrics: Record<string, number> = {},
  topology?: TopologyFlags,
): TemplateKpiRow[] {
  if (!templateId) return []
  const defs = TEMPLATE_KPIS[templateId]
  const hasMetricRows = Boolean(TEMPLATE_METRIC_ROWS[templateId]?.length)
  if (!defs?.length && !hasMetricRows && templateId !== 'url-shortener') {
    if (Object.keys(templateMetrics).length === 0) return []
  }

  const rows: TemplateKpiRow[] = []
  if (defs?.length) {
    for (const d of defs) {
      if (
        templateId === 'ecommerce' &&
        d.id === 'orders' &&
        preferEcommerceCheckoutTotals(templateMetrics)
      ) {
        continue
      }
      if (
        isSocialFeedTemplate(templateId) &&
        d.id === 'posts' &&
        preferSocialPostTotals(templateMetrics)
      ) {
        continue
      }
      const n = d.compute(metrics, inspector, nodes, loadgen)
      if (n == null) continue
      rows.push(kpiRow(d.id, d.label, d.format(n), n))
    }
  }

  if (templateId === 'ecommerce' && preferEcommerceCheckoutTotals(templateMetrics)) {
    const s = templateMetrics['checkout.sync_total']
    const a = templateMetrics['checkout.async_total']
    if (
      s != null &&
      Number.isFinite(s) &&
      isMetricRelevant(templateId, 'checkout.sync_total', topology)
    ) {
      rows.push(
        kpiRow(
          'tm-checkout-sync-total',
          'Checkouts written (sync)',
          fmtInt(Math.round(s)),
          Math.round(s),
        ),
      )
    }
    if (
      a != null &&
      Number.isFinite(a) &&
      isMetricRelevant(templateId, 'checkout.async_total', topology)
    ) {
      rows.push(
        kpiRow(
          'tm-checkout-async-total',
          'Checkouts written (async)',
          fmtInt(Math.round(a)),
          Math.round(a),
        ),
      )
    }
  }

  if (isSocialFeedTemplate(templateId) && preferSocialPostTotals(templateMetrics)) {
    const s = templateMetrics['posts.total_sync']
    const a = templateMetrics['posts.total_async']
    if (
      s != null &&
      Number.isFinite(s) &&
      isMetricRelevant(templateId, 'posts.total_sync', topology)
    ) {
      rows.push(
        kpiRow(
          'tm-posts-sync',
          'Posts written (sync)',
          fmtInt(Math.round(s)),
          Math.round(s),
        ),
      )
    }
    if (
      templateId === 'social-feed' &&
      a != null &&
      Number.isFinite(a) &&
      isMetricRelevant(templateId, 'posts.total_async', topology)
    ) {
      rows.push(
        kpiRow(
          'tm-posts-async',
          'Posts written (async)',
          fmtInt(Math.round(a)),
          Math.round(a),
        ),
      )
    }
  }

  if (templateId === 'url-shortener') {
    const c = templateMetrics['shortener.collisions']
    const numeric = c != null && Number.isFinite(c) ? Math.round(c) : undefined
    rows.push(
      kpiRow(
        'collisions',
        'Collisions',
        numeric != null ? fmtInt(numeric) : TELEMETRY_PENDING,
        numeric,
      ),
    )
  }

  const skipKeys = new Set<string>()
  if (isSocialFeedTemplate(templateId) && preferSocialPostTotals(templateMetrics)) {
    skipKeys.add('posts.total_sync')
    if (templateId === 'social-feed') skipKeys.add('posts.total_async')
  }
  if (templateId === 'ecommerce' && preferEcommerceCheckoutTotals(templateMetrics)) {
    skipKeys.add('checkout.sync_total')
    skipKeys.add('checkout.async_total')
  }

  const extra = TEMPLATE_METRIC_ROWS[templateId]
  if (extra?.length) {
    for (const { key, label, format } of extra) {
      if (skipKeys.has(key)) continue
      if (isConventionMetricKey(key)) continue
      if (!isMetricRelevant(templateId, key, topology)) continue
      const v = templateMetrics[key]
      if (v == null || !Number.isFinite(v)) continue
      rows.push(kpiRow(`tm-${key}`, label, format(v), v))
    }
  }

  rows.push(...conventionKpiRows(templateId, templateMetrics, topology))
  return rows.slice(0, MAX_TEMPLATE_KPI_ROWS)
}
