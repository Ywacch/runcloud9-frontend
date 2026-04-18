import type { CanvasNode } from '../store/canvasStore'
import type { LiveLoadgenState, MetricsBucket } from '../store/metricsStore'
import type { SimNodeInspector } from './simulation/types'
import { fmtInt } from './format'
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

/** Until the backend exposes collision counts. */
const COLLISION_PLACEHOLDER = '— (telemetry TBD)'

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

export const TEMPLATE_KPIS: Record<string, TemplateKpi[]> = {
  'url-shortener': urlShortenerKpis,
  ecommerce: ecommerceKpis,
  'social-feed': socialKpis,
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
  loadgen: LiveLoadgenState | null
): TemplateKpiRow[] {
  if (!templateId) return []
  const defs = TEMPLATE_KPIS[templateId]
  if (!defs?.length) return []

  const rows: TemplateKpiRow[] = []
  for (const d of defs) {
    const n = d.compute(metrics, inspector, nodes, loadgen)
    if (n == null) continue
    rows.push({ id: d.id, label: d.label, value: d.format(n) })
  }
  if (templateId === 'url-shortener') {
    rows.push({
      id: 'collisions',
      label: 'Collisions',
      value: COLLISION_PLACEHOLDER,
    })
  }
  return rows
}
