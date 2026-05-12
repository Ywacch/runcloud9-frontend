import { useEffect, useMemo } from 'react'
import { backendComponentToCanvasType } from '../lib/typeMapping'
import { fmtMs } from '../lib/format'
import { journeyStepHeading, type JourneySpec } from '../lib/requestJourney'
import type { CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'

function firstMetricsForBackend(
  nodes: Record<string, CanvasNode>,
  metrics: Record<string, MetricsBucket>,
  backend: JourneySpec['steps'][0]['component']
): MetricsBucket | undefined {
  const canvasType = backendComponentToCanvasType[backend]
  if (!canvasType) return undefined
  const n = Object.values(nodes).find((x) => x.type === canvasType)
  return n ? metrics[n.id] : undefined
}

interface RequestJourneyPanelProps {
  open: boolean
  overview: boolean
  journey: JourneySpec | null
  allJourneys: JourneySpec[]
  nodes: Record<string, CanvasNode>
  metrics: Record<string, MetricsBucket>
  onClose: () => void
  onSelectJourney: (id: string) => void
}

export function RequestJourneyPanel({
  open,
  overview,
  journey,
  allJourneys,
  nodes,
  metrics,
  onClose,
  onSelectJourney,
}: RequestJourneyPanelProps) {
  const stepsWithP99 = useMemo(() => {
    if (!journey) return []
    return journey.steps.map((step, i) => {
      const m = firstMetricsForBackend(nodes, metrics, step.component)
      return { step, index: i, p99: m?.p99Latency }
    })
  }, [journey, nodes, metrics])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="max-h-[min(92vh,36rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 p-5 text-[var(--c9-text)] shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {overview ? (
          <>
            <h2 className="text-lg font-semibold text-violet-300">Request journeys</h2>
            <p className="mt-1 text-xs text-[var(--c9-muted)]">
              Pick a request type to see how it flows through your current topology.
            </p>
            <ul className="mt-4 space-y-2">
              {allJourneys.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/40 px-3 py-2 text-left text-sm text-[var(--c9-text)] hover:border-cyan-500/40 hover:bg-[var(--c9-surface)]"
                    onClick={() => onSelectJourney(j.id)}
                  >
                    <span className="font-mono text-xs text-cyan-300/90">
                      {j.method} {j.path}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--c9-muted)]">
                      {j.label}
                      {j.trafficPercent != null ? ` · ~${j.trafficPercent}% traffic` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : journey ? (
          <>
            <div className="border-b border-[var(--c9-border)] pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
                Request journey
              </p>
              <h2 className="mt-1 text-lg font-semibold text-violet-300">
                {journey.method} {journey.path}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--c9-muted)]">
                {journey.label}
                {journey.trafficPercent != null
                  ? ` · ~${journey.trafficPercent}% of traffic`
                  : ''}
              </p>
            </div>
            <ol className="relative mt-4 space-y-0 border-l-2 border-cyan-500/30 pl-5">
              {stepsWithP99.map(({ step, index, p99 }) => (
                <li key={`${journey.id}-${index}`} className="pb-6 last:pb-0">
                  <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/50 bg-[var(--c9-bg)] text-[10px] font-bold text-cyan-300">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-zinc-100">
                    {journeyStepHeading(step, index)}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-200">{step.action}</p>
                  {step.detail ? (
                    <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-2 font-mono text-[11px] text-zinc-300">
                      {step.detail}
                    </pre>
                  ) : null}
                  {p99 != null && p99 > 0 ? (
                    <p className="mt-2 font-mono text-[11px] text-zinc-400">
                      Live p99 (this component): {fmtMs(p99)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
            <div className="mt-6 border-t border-[var(--c9-border)] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
                Why this matters
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">{journey.explanation}</p>
            </div>
          </>
        ) : null}

        <div className="mt-6 flex justify-between gap-2">
          {!overview && journey && allJourneys.length > 1 ? (
            <button
              type="button"
              className="rounded border border-[var(--c9-border)] px-3 py-2 text-xs text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
              onClick={() => onSelectJourney('__overview__')}
            >
              All journeys
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-4 py-2 text-sm text-[var(--c9-text)] hover:bg-[var(--c9-bg)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
