import { useMemo } from 'react'
import { FMT_EMPTY, fmtInt, fmtMs, fmtRate } from '../lib/format'
import { useMetricsStore } from '../editor-core/stores/metricsStore'

const TEMPLATE_METRIC_LABELS: Record<string, string> = {
  'mq.queue_depth': 'MQ queue depth',
  'mq.produce_rate': 'MQ produce rate',
  'mq.consume_rate': 'MQ consume rate',
  'mq.saturation_ratio': 'MQ saturation ratio',
  'worker.backlog': 'Worker backlog',
  'worker.redis_write_rate': 'Worker Redis write rate',
  'worker.consume_rate': 'Worker consume rate',
  'worker.errors.redis': 'Worker Redis error rate',
  'redis.ops_per_sec': 'Redis ops/sec',
  'redis.connected_clients': 'Redis connected clients',
  'redis.rejected_connections_rate': 'Redis rejected conn rate',
  'redis.avg_latency': 'Redis avg latency',
}

/** Compact read-only table of latest `templateMetrics` from the WS (backend Prometheus). */
export function TemplateMetricsSnippet({
  title = 'Template metrics',
  compact = false,
  templateMetrics,
}: {
  title?: string
  compact?: boolean
  templateMetrics?: Record<string, number>
}) {
  const storeTemplateMetrics = useMetricsStore((s) => s.templateMetrics)
  const metrics = templateMetrics ?? storeTemplateMetrics
  const rows = useMemo(() => {
    const entries = Object.entries(metrics)
    entries.sort(([a], [b]) => a.localeCompare(b))
    return entries
  }, [metrics])

  if (rows.length === 0) return null

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <h3
        className={`font-semibold uppercase tracking-wider text-gray-400 ${
          compact ? 'text-[9px]' : 'text-xs'
        }`}
      >
        {title}
      </h3>
      <div
        className={`overflow-x-auto rounded border border-gray-700/50 bg-gray-900/40 ${
          compact ? 'max-h-28 text-[10px]' : 'text-[11px]'
        }`}
      >
        <table className="w-full min-w-[200px] text-left text-gray-300">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-gray-800/80 first:border-t-0">
                <td className="max-w-[55%] truncate px-2 py-1 font-mono text-gray-400" title={k}>
                  {TEMPLATE_METRIC_LABELS[k] ?? k}
                </td>
                <td className="px-2 py-1 text-right font-mono text-gray-100">
                  {formatTemplateMetricValue(k, v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatTemplateMetricValue(key: string, v: number): string {
  if (!Number.isFinite(v)) return FMT_EMPTY
  if (key === 'mq.saturation_ratio') return `${v.toFixed(2)}×`
  if (key === 'redis.avg_latency') return fmtMs(v * 1000)
  if (
    key === 'mq.queue_depth' ||
    key === 'worker.backlog' ||
    key === 'redis.connected_clients'
  ) {
    return fmtInt(Math.round(v))
  }
  if (
    key === 'redis.ops_per_sec' ||
    key === 'redis.rejected_connections_rate'
  ) {
    return `${fmtRate(v)}/s`
  }
  if (key.includes('fanout')) {
    return Math.abs(v - Math.round(v)) < 1e-3 ? fmtInt(Math.round(v)) : v.toFixed(2)
  }
  if (key.includes('p95') || key.includes('p99') || key.includes('p50') || /_p\d+$/.test(key)) {
    return fmtMs(v * 1000)
  }
  if (key.includes('rate') || key.includes('pull_') || key.includes('push_')) {
    return `${fmtRate(v)}/s`
  }
  if (Math.abs(v - Math.round(v)) < 1e-6) return fmtInt(Math.round(v))
  return v.toFixed(3)
}
