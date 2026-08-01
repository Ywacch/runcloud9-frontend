import { fmtInt, fmtMs, fmtRate } from '../lib/format'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { MetricChart } from './MetricChart'
import { LatencyNeedleChart } from './LatencyNeedleChart'

function appServerObservedRps(
  metrics: ReturnType<typeof useMetricsStore.getState>['metrics'],
  nodes: ReturnType<typeof useCanvasStore.getState>['nodes'],
): number {
  let best = 0
  for (const n of Object.values(nodes)) {
    if (n.type !== 'compute') continue
    best = Math.max(best, metrics[n.id]?.requestRate ?? 0)
  }
  return best
}

function statusCodeChipClass(code: string): string {
  const n = Number(code)
  if (Number.isFinite(n)) {
    if (n >= 500) return 'border-red-500/40 bg-red-500/10 text-red-200/90'
    if (n >= 400) return 'border-amber-500/40 bg-amber-500/10 text-amber-200/90'
    if (n >= 200 && n < 300) return 'border-[var(--c9-border)] bg-[var(--c9-surface)] text-[var(--c9-muted)]'
  }
  return 'border-[var(--c9-border)] bg-[var(--c9-surface)] text-[var(--c9-text)]'
}

/** Three-way loadgen check (metrics-ui-contract § Load generator panel). */
export function LoadgenMetricsPanel() {
  const loadgen = useMetricsStore((s) => s.loadgen)
  const metrics = useMetricsStore((s) => s.metrics)
  const nodes = useCanvasStore((s) => s.nodes)

  if (!loadgen) return null

  const serverRps = appServerObservedRps(metrics, nodes)
  const intervalSpark = loadgen.recentIntervals.map((b) => b.actualRps)
  const throttleHint =
    loadgen.active &&
    loadgen.targetRps > 0 &&
    loadgen.actualRps > 0 &&
    loadgen.actualRps < loadgen.targetRps * 0.85
      ? 'Generator may be throttling. Achieved RPS is well below target.'
      : loadgen.active &&
          loadgen.actualRps >= loadgen.targetRps * 0.85 &&
          serverRps > 0 &&
          serverRps < loadgen.actualRps * 0.85
        ? 'Achieved matches target but app RPS is lower. Check errors or path.'
        : null

  return (
    <div className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 px-2.5 py-2 text-xs backdrop-blur-md">
      <p className="mb-1.5 font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        Load generator
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
        <div>
          <span className="text-[var(--c9-muted)]">Target</span>{' '}
          <span className="font-mono font-semibold text-[var(--c9-text)]">
            {fmtRate(loadgen.targetRps)}
          </span>
        </div>
        <div>
          <span className="text-[var(--c9-muted)]">Achieved</span>{' '}
          <span className="font-mono font-semibold text-[var(--c9-text)]">
            {fmtRate(loadgen.actualRps)}
          </span>
        </div>
        <div>
          <span className="text-[var(--c9-muted)]">Server (app)</span>{' '}
          <span className="font-mono font-semibold text-[var(--c9-text)]">
            {fmtRate(serverRps)}
          </span>
        </div>
        <div>
          <span className="text-[var(--c9-muted)]">Last 5s</span>{' '}
          <span className="font-mono font-semibold text-[var(--c9-text)]">
            {fmtRate(loadgen.intervalActualRps)} · {fmtMs(loadgen.intervalP99Ms)}
          </span>
        </div>
      </div>
      {Object.keys(loadgen.statusCodes).length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(loadgen.statusCodes)
            .sort(([, a], [, b]) => b - a)
            .map(([code, count]) => (
              <span
                key={code}
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none ${statusCodeChipClass(code)}`}
              >
                {code} · {fmtInt(count)}
              </span>
            ))}
        </div>
      ) : null}
      {intervalSpark.length >= 2 ? (
        <div className="mt-2">
          <MetricChart
            title="Achieved RPS"
            unit="5s buckets"
            series={[{ data: intervalSpark, color: '#6366f1', showArea: true }]}
            compact
          />
        </div>
      ) : null}
      <div className="mt-2">
        <LatencyNeedleChart latenciesMs={loadgen.recentLatenciesMs} />
      </div>
      {throttleHint ? (
        <p className="mt-1.5 text-[10px] leading-snug text-amber-200/90">{throttleHint}</p>
      ) : null}
    </div>
  )
}
