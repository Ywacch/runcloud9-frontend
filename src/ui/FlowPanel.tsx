import { useEffect, useMemo } from 'react'
import { fmtMs, fmtPct, fmtRate } from '../lib/format'
import { buildFlowPaths } from '../lib/flowPaths'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { templateTitleForId } from './TemplateModal'

interface FlowPanelProps {
  open: boolean
  onClose: () => void
}

function edgeTag(x?: string): string {
  if (!x) return 'ingress'
  if (x === 'absorb-on-hit') return 'cache decision'
  if (x === 'load-distribute') return 'load split'
  if (x === 'async-decouple') return 'async handoff'
  return 'route'
}

export function FlowPanel({ open, onClose }: FlowPanelProps) {
  const mode = useCanvasStore((s) => s.mode)
  const templateId = useCanvasStore((s) => s.snapshotTemplateId)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const metrics = useMetricsStore((s) => s.metrics)
  const inspector = useSimulationStore((s) => s.lastInspector)
  const running = useSimulationStore((s) => s.running)
  const tick = useSimulationStore((s) => s.tick)

  const paths = useMemo(
    () => buildFlowPaths(nodes, edges, metrics, inspector),
    [nodes, edges, metrics, inspector]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const title = templateTitleForId(templateId) ?? templateId ?? 'Template'
  const unavailable = mode !== 'simulate'

  return (
    <>
      <button
        type="button"
        className="pointer-events-auto fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
        aria-label="Close flow panel"
        onClick={onClose}
      />
      <aside
        className="pointer-events-auto fixed right-0 top-0 z-[70] flex h-full max-h-dvh w-full max-w-lg flex-col overflow-hidden border-l border-white/10 bg-gray-950/95 shadow-2xl backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 id="flow-panel-title" className="text-sm font-semibold text-white">
              Request flow
            </h2>
            <p className="text-xs text-zinc-400">
              {title} {mode === 'simulate' ? `· Tick ${tick}` : ''}
            </p>
            <p className="mt-1 max-w-md text-[11px] leading-snug text-zinc-500">
              Paths are inferred from your canvas topology and simulation inspector aggregates — not packet
              traces or production APM.
            </p>
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {unavailable ? (
            <p className="text-sm text-zinc-400">
              Flow paths are available in simulation mode only for now.
            </p>
          ) : !running && tick === 0 ? (
            <p className="text-sm text-zinc-400">
              Start simulation to populate flow paths.
            </p>
          ) : paths.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No paths found. Add connected nodes (for example client → app → data tier).
            </p>
          ) : (
            <div className="space-y-4">
              {paths.map((path) => (
                <section key={path.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-100">{path.name}</p>
                    <p className="font-mono text-xs text-zinc-300">
                      total {fmtMs(path.totalLatencyMs)}
                    </p>
                  </div>
                  {path.asyncContinuation ? (
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-violet-300">
                      async continuation
                    </p>
                  ) : null}
                  <ol className="space-y-2">
                    {path.hops.map((hop, idx) => (
                      <li key={`${path.id}-${hop.nodeId}-${idx}`} className="rounded border border-white/5 bg-gray-900/40 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-zinc-100">
                              {idx + 1}. {hop.label}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                              {hop.type.replace('_', ' ')} · {edgeTag(hop.edgeSemantics)}
                            </p>
                          </div>
                          <div className="text-right text-[11px] font-mono text-zinc-300">
                            <div>{fmtRate(hop.qps)} rps</div>
                            <div>{fmtMs(hop.latencyMs)} p99</div>
                            <div>{fmtPct(hop.errorRate * 100)} err</div>
                          </div>
                        </div>
                        {hop.note ? (
                          <p className="mt-1 text-[11px] text-zinc-400">{hop.note}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
