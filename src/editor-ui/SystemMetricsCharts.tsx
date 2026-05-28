import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { SparkLine } from './SparkLine'

const sparkWrap =
  'rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/40 p-1.5'

/** Live WS teaching charts (metrics-ui-contract § Server-side latency and throughput). */
export function SystemMetricsCharts() {
  const series = useMetricsStore((s) => s.systemSeries)

  if (series.length < 2) return null

  const p99 = series.map((s) => s.appP99Ms)
  const rps = series.map((s) => s.appRps)
  const dbRate = series.map((s) => s.dbQueryRate)
  const hits = series.map((s) => s.cacheHits)
  const misses = series.map((s) => s.cacheMisses)

  return (
    <div className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 px-2.5 py-2 backdrop-blur-md">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        System metrics (live)
      </p>
      <p className="mb-2 text-[10px] leading-snug text-[var(--c9-muted)]">
        Prometheus ~30s rate window · one point every ~2s
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className={sparkWrap}>
          <p className="mb-1 text-[10px] text-[var(--c9-muted)]">App p99 (ms)</p>
          <SparkLine data={p99} color="var(--c9-error)" showArea height={40} />
        </div>
        <div className={sparkWrap}>
          <p className="mb-1 text-[10px] text-[var(--c9-muted)]">App RPS</p>
          <SparkLine data={rps} color="var(--c9-success)" showArea height={40} />
        </div>
        <div className={sparkWrap}>
          <p className="mb-1 text-[10px] text-[var(--c9-muted)]">DB query rate</p>
          <SparkLine data={dbRate} color="var(--c9-info)" showArea height={40} />
        </div>
        <div className={sparkWrap}>
          <p className="mb-1 text-[10px] text-[var(--c9-muted)]">Cache hits / misses (app)</p>
          <SparkLine data={hits} color="var(--c9-accent-hover)" showArea height={40} />
          <SparkLine data={misses} color="var(--c9-warning)" height={40} />
        </div>
      </div>
    </div>
  )
}
