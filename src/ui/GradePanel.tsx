import { useEffect, useMemo } from 'react'
import { evaluateRequirements, type RequirementStatus } from '../lib/requirements'
import { computeSystemAggregates } from '../lib/systemMetrics'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'
import { TemplateMetricsSnippet } from './TemplateMetricsSnippet'
import { useSimulationStore } from '../store/simulationStore'
import { templateTitleForId } from './TemplateModal'

function statusIcon(status: RequirementStatus): string {
  if (status === 'pass') return '✓'
  if (status === 'partial') return '~'
  return '✗'
}

function statusRowClass(status: RequirementStatus): string {
  if (status === 'pass') return 'text-emerald-300'
  if (status === 'partial') return 'text-amber-200'
  return 'text-red-300'
}

function letterBadgeClass(letter: string): string {
  if (letter.startsWith('A')) return 'bg-emerald-500/25 text-emerald-200 ring-emerald-500/40'
  if (letter.startsWith('B')) return 'bg-sky-500/25 text-sky-200 ring-sky-500/40'
  if (letter.startsWith('C')) return 'bg-amber-500/25 text-amber-100 ring-amber-500/40'
  return 'bg-red-500/25 text-red-200 ring-red-500/40'
}

interface GradePanelProps {
  open: boolean
  onClose: () => void
}

export function GradePanel({ open, onClose }: GradePanelProps) {
  const mode = useCanvasStore((s) => s.mode)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const nodes = useCanvasStore((s) => s.nodes)
  const metrics = useMetricsStore((s) => s.metrics)
  const loadgen = useMetricsStore((s) => s.loadgen)
  const lastInspector = useSimulationStore((s) => s.lastInspector)
  const simRunning = useSimulationStore((s) => s.running)
  const templateMetrics = useMetricsStore((s) => s.templateMetrics)

  const evaluation = useMemo(() => {
    if (mode !== 'live' && mode !== 'simulate') return null
    const aggregates =
      mode === 'live' || mode === 'simulate'
        ? computeSystemAggregates(
            metrics,
            nodes,
            loadgen,
            mode,
            lastInspector,
            simRunning
          )
        : null
    return evaluateRequirements(snapshotTemplateId, {
      metrics,
      nodes,
      inspector: lastInspector,
      aggregates,
      mode,
    })
  }, [
    metrics,
    nodes,
    loadgen,
    mode,
    lastInspector,
    simRunning,
    snapshotTemplateId,
  ])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const title =
    templateTitleForId(snapshotTemplateId) ?? snapshotTemplateId ?? 'Template'

  return (
    <>
      <button
        type="button"
        className="pointer-events-auto fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
        aria-label="Close grade panel"
        onClick={onClose}
      />
      <aside
        className="pointer-events-auto fixed right-0 top-0 z-[70] flex h-full max-h-dvh w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-gray-950/95 shadow-2xl backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grade-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2
              id="grade-panel-title"
              className="text-sm font-semibold text-white"
            >
              Design grade
            </h2>
            <p className="text-xs text-zinc-400">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {mode === 'live' && Object.keys(templateMetrics).length > 0 ? (
          <div className="shrink-0 border-b border-white/10 px-4 pb-3">
            <TemplateMetricsSnippet title="Live template telemetry" compact />
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 touch-pan-y">
          {!evaluation ? (
            <p className="text-sm text-zinc-400">
              No grading rubric is defined for this template yet. Try the URL
              Shortener template for a full functional / non-functional
              checklist.
            </p>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-3xl font-bold tabular-nums ring-2 ${letterBadgeClass(evaluation.letter)}`}
                >
                  {evaluation.letter}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Weighted score
                  </p>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {evaluation.scorePercent}
                    <span className="text-base font-medium text-zinc-400">%</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                    Pass = full credit, partial = half, fail = none. For
                    teaching only — not a production SLO review.
                  </p>
                </div>
              </div>

              {(['functional', 'non-functional'] as const).map((cat) => {
                const rows = evaluation.results.filter((r) => r.def.category === cat)
                if (rows.length === 0) return null
                return (
                  <section key={cat} className="mb-6">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {cat === 'functional'
                        ? 'Functional requirements'
                        : 'Non-functional requirements'}
                    </h3>
                    <ul className="space-y-3">
                      {rows.map((r) => (
                        <li
                          key={r.def.id}
                          className="rounded-lg border border-white/5 bg-black/20 px-3 py-2"
                        >
                          <div className="flex gap-2">
                            <span
                              className={`shrink-0 font-mono text-sm ${statusRowClass(r.status)}`}
                              title={r.status}
                            >
                              {statusIcon(r.status)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-zinc-100">
                                {r.def.label}
                              </p>
                              <p className="mt-0.5 text-[11px] text-zinc-500">
                                {r.def.description}
                              </p>
                              <p className="mt-1.5 text-xs leading-snug text-zinc-300">
                                {r.detail}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
