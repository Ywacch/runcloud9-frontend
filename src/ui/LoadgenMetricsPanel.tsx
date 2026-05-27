import { fmtMs, fmtRate } from '../lib/format'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'
import { SparkLine } from './SparkLine'

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
      ? 'Generator may be throttling — achieved RPS is well below target.'
      : loadgen.active &&
          loadgen.actualRps >= loadgen.targetRps * 0.85 &&
          serverRps > 0 &&
          serverRps < loadgen.actualRps * 0.85
        ? 'Achieved matches target but app RPS is lower — check errors or path.'
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
      {intervalSpark.length >= 2 ? (
        <div className="mt-2 rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/40 p-1.5">
          <p className="mb-1 text-[10px] text-[var(--c9-muted)]">
            Achieved RPS (5s buckets)
          </p>
          <SparkLine data={intervalSpark} color="#34d399" showArea height={36} />
        </div>
      ) : null}
      {throttleHint ? (
        <p className="mt-1.5 text-[10px] leading-snug text-amber-200/90">{throttleHint}</p>
      ) : null}
    </div>
  )
}
