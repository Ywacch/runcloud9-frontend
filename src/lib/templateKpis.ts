import type { TopologyFlags } from './componentRole'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { LiveLoadgenState, MetricsBucket } from '../editor-core/stores/metricsStore'
import type { SimNodeInspector } from '../editor-core/domain/simulation/types'
import { fmtInt, fmtMs, fmtRate } from './format'
import { readWriteFractions } from '../editor-core/domain/simulation/workload'
import { workloadProfileForTemplate } from '../editor-core/domain/simulation/workloadProfiles'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'

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
const TELEMETRY_PENDING = '—'

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
    { key: 'feed.pull_rate', label: 'Feed reads/s (pull)', format: (n) => `${fmtRate(n)}/s` },
    { key: 'feed.push_rate', label: 'Feed reads/s (push)', format: (n) => `${fmtRate(n)}/s` },
    {
      key: 'feed.push_total',
      label: 'Feed reads (push)',
      format: (n) => fmtInt(Math.round(n)),
    },
    { key: 'feed.pull_p95', label: 'Feed read p95 (pull)', format: (n) => fmtMs(n * 1000) },
    { key: 'feed.push_p95', label: 'Feed read p95 (push)', format: (n) => fmtMs(n * 1000) },
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
    { key: 'feed.pull_rate', label: 'Feed reads/s (pull)', format: (n) => `${fmtRate(n)}/s` },
    { key: 'feed.pull_p95', label: 'Feed read p95 (pull)', format: (n) => fmtMs(n * 1000) },
    { key: 'posts.total_sync', label: 'Posts written (sync)', format: (n) => fmtInt(Math.round(n)) },
  ],
  ecommerce: [
    {
      key: 'checkout.inventory_conflicts',
      label: 'Inventory conflicts',
      format: (n) => fmtInt(Math.round(n)),
    },
    { key: 'checkout.sync_p95', label: 'Checkout p95 (sync)', format: (n) => fmtMs(n * 1000) },
    { key: 'checkout.async_p95', label: 'Checkout p95 (async)', format: (n) => fmtMs(n * 1000) },
    { key: 'mq.publish_errors', label: 'Publish failures', format: (n) => fmtInt(Math.round(n)) },
    { key: 'mq.publish_total', label: 'Messages published', format: (n) => fmtInt(Math.round(n)) },
  ],
}

export interface TemplateKpiRow {
  id: string
  label: string
  value: string
}

function isMetricRelevant(
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

/** Journey KPIs in SystemTopBar — keep scannable (metrics-component-panels §2.7). */
const MAX_TEMPLATE_KPI_ROWS = 6

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
  if (!defs?.length) return []

  const rows: TemplateKpiRow[] = []
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
    rows.push({ id: d.id, label: d.label, value: d.format(n) })
  }

  if (templateId === 'ecommerce' && preferEcommerceCheckoutTotals(templateMetrics)) {
    const s = templateMetrics['checkout.sync_total']
    const a = templateMetrics['checkout.async_total']
    if (
      s != null &&
      Number.isFinite(s) &&
      isMetricRelevant(templateId, 'checkout.sync_total', topology)
    ) {
      rows.push({
        id: 'tm-checkout-sync-total',
        label: 'Checkouts written (sync)',
        value: fmtInt(Math.round(s)),
      })
    }
    if (
      a != null &&
      Number.isFinite(a) &&
      isMetricRelevant(templateId, 'checkout.async_total', topology)
    ) {
      rows.push({
        id: 'tm-checkout-async-total',
        label: 'Checkouts written (async)',
        value: fmtInt(Math.round(a)),
      })
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
      rows.push({
        id: 'tm-posts-sync',
        label: 'Posts written (sync)',
        value: fmtInt(Math.round(s)),
      })
    }
    if (
      templateId === 'social-feed' &&
      a != null &&
      Number.isFinite(a) &&
      isMetricRelevant(templateId, 'posts.total_async', topology)
    ) {
      rows.push({
        id: 'tm-posts-async',
        label: 'Posts written (async)',
        value: fmtInt(Math.round(a)),
      })
    }
  }

  if (templateId === 'url-shortener') {
    const c = templateMetrics['shortener.collisions']
    rows.push({
      id: 'collisions',
      label: 'Collisions',
      value:
        c != null && Number.isFinite(c) ? fmtInt(Math.round(c)) : TELEMETRY_PENDING,
    })
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
      if (!isMetricRelevant(templateId, key, topology)) continue
      const v = templateMetrics[key]
      if (v == null || !Number.isFinite(v)) continue
      rows.push({
        id: `tm-${key}`,
        label,
        value: format(v),
      })
    }
  }
  return rows.slice(0, MAX_TEMPLATE_KPI_ROWS)
}
