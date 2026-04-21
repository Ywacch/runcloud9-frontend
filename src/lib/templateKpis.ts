import type { CanvasNode } from '../store/canvasStore'
import type { LiveLoadgenState, MetricsBucket } from '../store/metricsStore'
import type { SimNodeInspector } from './simulation/types'
import { fmtInt, fmtMs, fmtRate } from './format'
import { readWriteFractions } from './simulation/workload'
import { workloadProfileForTemplate } from './simulation/workloadProfiles'
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

const socialKpis: TemplateKpi[] = [
  {
    id: 'posts',
    label: 'Posts / writes (est.)',
    compute: (metrics, _insp, _nodes, loadgen) => {
      const total = ingressTotalRequests(metrics, loadgen)
      return Math.max(0, Math.floor(total * writeShare('social-feed')))
    },
    format: (v) => fmtInt(v),
  },
]

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
}

/** Optional rows merged from backend `templateMetrics` (see ganymede `collectTemplateMetrics`). */
const TEMPLATE_METRIC_ROWS: Record<
  string,
  Array<{ key: string; label: string; format: (n: number) => string }>
> = {
  'social-feed': [
    { key: 'feed.pull_rate', label: 'Feed pull rate', format: (n) => `${fmtRate(n)}/s` },
    { key: 'feed.push_rate', label: 'Feed push rate', format: (n) => `${fmtRate(n)}/s` },
    {
      key: 'feed.pull_p95',
      label: 'Feed pull p95',
      format: (n) => fmtMs(n * 1000),
    },
    {
      key: 'feed.push_p95',
      label: 'Feed push p95',
      format: (n) => fmtMs(n * 1000),
    },
    { key: 'worker.processed', label: 'Worker processed', format: (n) => fmtInt(Math.round(n)) },
    { key: 'worker.errors', label: 'Worker errors', format: (n) => fmtInt(Math.round(n)) },
    {
      key: 'worker.fanout_p99',
      label: 'Worker fanout p99',
      format: (n) => (n >= 10 ? fmtInt(Math.round(n)) : n.toFixed(2)),
    },
    { key: 'mq.publish_total', label: 'MQ publish total', format: (n) => fmtInt(Math.round(n)) },
  ],
  ecommerce: [
    {
      key: 'checkout.inventory_conflicts',
      label: 'Inventory conflicts',
      format: (n) => fmtInt(Math.round(n)),
    },
    {
      key: 'checkout.sync_p95',
      label: 'Checkout sync p95',
      format: (n) => fmtMs(n * 1000),
    },
    {
      key: 'checkout.async_p95',
      label: 'Checkout async p95',
      format: (n) => fmtMs(n * 1000),
    },
    { key: 'mq.publish_errors', label: 'MQ publish errors', format: (n) => fmtInt(Math.round(n)) },
    { key: 'mq.publish_total', label: 'MQ publish total', format: (n) => fmtInt(Math.round(n)) },
  ],
}

export interface TemplateKpiRow {
  id: string
  label: string
  value: string
}

export function templateKpiRows(
  templateId: string | null | undefined,
  metrics: Record<string, MetricsBucket>,
  inspector: Record<string, SimNodeInspector>,
  nodes: Record<string, CanvasNode>,
  loadgen: LiveLoadgenState | null,
  templateMetrics: Record<string, number> = {}
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
      templateId === 'social-feed' &&
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
    if (s != null && Number.isFinite(s)) {
      rows.push({
        id: 'tm-checkout-sync-total',
        label: 'Checkouts (sync)',
        value: fmtInt(Math.round(s)),
      })
    }
    if (a != null && Number.isFinite(a)) {
      rows.push({
        id: 'tm-checkout-async-total',
        label: 'Checkouts (async)',
        value: fmtInt(Math.round(a)),
      })
    }
  }

  if (templateId === 'social-feed' && preferSocialPostTotals(templateMetrics)) {
    const s = templateMetrics['posts.total_sync']
    const a = templateMetrics['posts.total_async']
    if (s != null && Number.isFinite(s)) {
      rows.push({
        id: 'tm-posts-sync',
        label: 'Posts (sync)',
        value: fmtInt(Math.round(s)),
      })
    }
    if (a != null && Number.isFinite(a)) {
      rows.push({
        id: 'tm-posts-async',
        label: 'Posts (async)',
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
  if (templateId === 'social-feed' && preferSocialPostTotals(templateMetrics)) {
    skipKeys.add('posts.total_sync')
    skipKeys.add('posts.total_async')
  }
  if (templateId === 'ecommerce' && preferEcommerceCheckoutTotals(templateMetrics)) {
    skipKeys.add('checkout.sync_total')
    skipKeys.add('checkout.async_total')
  }

  const extra = TEMPLATE_METRIC_ROWS[templateId]
  if (extra?.length) {
    for (const { key, label, format } of extra) {
      if (skipKeys.has(key)) continue
      const v = templateMetrics[key]
      if (v == null || !Number.isFinite(v)) continue
      rows.push({
        id: `tm-${key}`,
        label,
        value: format(v),
      })
    }
  }
  return rows
}
