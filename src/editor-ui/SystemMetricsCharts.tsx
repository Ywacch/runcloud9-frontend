import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { MetricChart } from './MetricChart'

/** Live WS teaching charts (metrics-ui-contract § Server-side latency and throughput). */
export function SystemMetricsCharts() {
  const series = useMetricsStore((s) => s.systemSeries)
  const chartFrozen = useMetricsStore((s) => s.chartFrozen)
  const catchingUp = useMetricsStore((s) => s.playbackCatchingUp)

  if (series.length < 2) return null

  const p99 = series.map((s) => s.appP99Ms)
  const rps = series.map((s) => s.appRps)
  const dbRate = series.map((s) => s.dbQueryRate)
  const hits = series.map((s) => s.cacheHits)
  const misses = series.map((s) => s.cacheMisses)

  return (
    <div className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-3 py-3 shadow-[var(--c9-shadow-card)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        System metrics (live)
      </p>
      <p className="mb-3 text-[10px] leading-snug text-[var(--c9-text-disabled)]">
        Prometheus ~10s rate window · one point every ~2s
        {chartFrozen ? (
          <span className="text-amber-400/90">
            {catchingUp ? ' · catching up…' : ' · reconnecting'}
          </span>
        ) : null}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricChart
          title="App p99 latency"
          unit="ms"
          showPlaybackDelay={false}
          series={[{ data: p99, color: 'var(--c9-error)', showArea: true }]}
        />
        <MetricChart
          title="App request rate"
          unit="RPS"
          showPlaybackDelay={false}
          series={[{ data: rps, color: '#6366f1', showArea: true }]}
        />
        <MetricChart
          title="DB query rate"
          unit="queries/s"
          showPlaybackDelay={false}
          series={[{ data: dbRate, color: 'var(--c9-info)', showArea: true }]}
        />
        <MetricChart
          title="Cache hits / misses"
          unit="app-reported /s"
          showPlaybackDelay={false}
          series={[
            { data: hits, color: '#22d3ee', label: 'Hits', showArea: false },
            { data: misses, color: 'var(--c9-warning)', label: 'Misses', showArea: false },
          ]}
        />
      </div>
    </div>
  )
}
