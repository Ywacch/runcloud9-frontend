import { useMemo, useState } from 'react'
import { fmtMs, fmtPct, fmtRate } from '../lib/format'
import { evaluateRequirements } from '../lib/requirements'
import { readWriteFractions } from '../lib/simulation/workload'
import { workloadProfileForTemplate } from '../lib/simulation/workloadProfiles'
import { computeSystemAggregates } from '../lib/systemMetrics'
import { templateKpiRows } from '../lib/templateKpis'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { FlowPanel } from './FlowPanel'
import { GradePanel } from './GradePanel'

const INGRESS_HELP_LIVE =
  'Requests per second entering the design: live load generator RPS. This is the workload hitting your system.'

const INGRESS_HELP_SIM =
  'Approximate ingress from the local simulation worker (client throughput), not packet capture or production telemetry.'

/** Compact label-above-value column (Cloudcraft-style density). */
function Stat({
  label,
  value,
  valueClass,
  wrap,
  containerClassName,
}: {
  label: string
  value: string
  valueClass?: string
  /** Multi-line value (e.g. load mix) — no truncation. */
  wrap?: boolean
  containerClassName?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-px ${containerClassName ?? ''}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
        {label}
      </span>
      <span
        className={`min-w-0 font-mono text-xs font-semibold text-zinc-50 ${valueClass ?? ''} ${
          wrap
            ? 'whitespace-normal break-words leading-snug'
            : 'truncate tabular-nums'
        }`}
        title={wrap ? undefined : value}
      >
        {value}
      </span>
    </div>
  )
}

export function SystemTopBar() {
  const [flowOpen, setFlowOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const mode = useCanvasStore((s) => s.mode)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const nodes = useCanvasStore((s) => s.nodes)
  const metrics = useMetricsStore((s) => s.metrics)
  const loadgen = useMetricsStore((s) => s.loadgen)
  const lastInspector = useSimulationStore((s) => s.lastInspector)
  const simRunning = useSimulationStore((s) => s.running)

  const mixLabel = useMemo(() => {
    const p = workloadProfileForTemplate(snapshotTemplateId)
    if (!p?.archetypes.length) return null
    const { read, write } = readWriteFractions(p)
    const r = Math.round(read * 100)
    const w = Math.round(write * 100)
    return `${p.readLabel ?? 'Reads'} ~${r}% · ${p.writeLabel ?? 'Writes'} ~${w}%`
  }, [snapshotTemplateId])

  const aggregates = useMemo(
    () =>
      mode === 'live' || mode === 'simulate'
        ? computeSystemAggregates(
            metrics,
            nodes,
            loadgen,
            mode,
            lastInspector,
            simRunning
          )
        : null,
    [metrics, nodes, loadgen, mode, lastInspector, simRunning]
  )

  const kpiRows = useMemo(
    () =>
      mode === 'live' || mode === 'simulate'
        ? templateKpiRows(
            snapshotTemplateId,
            metrics,
            lastInspector,
            nodes,
            loadgen
          )
        : [],
    [mode, snapshotTemplateId, metrics, lastInspector, nodes, loadgen]
  )

  const gradeEvaluation = useMemo(() => {
    if (mode !== 'live' && mode !== 'simulate') return null
    return evaluateRequirements(snapshotTemplateId, {
      metrics,
      nodes,
      inspector: lastInspector,
      aggregates,
      mode,
    })
  }, [snapshotTemplateId, metrics, nodes, lastInspector, aggregates, mode])

  if (mode !== 'live' && mode !== 'simulate') return null

  const ingressHelp = mode === 'simulate' ? INGRESS_HELP_SIM : INGRESS_HELP_LIVE

  const showWaiting = aggregates && !aggregates.hasComponentMetrics
  const throughput = aggregates?.throughputRps ?? 0
  const errPct = aggregates ? aggregates.systemErrorRate * 100 : 0
  const errTone =
    errPct >= 15
      ? '!text-red-300'
      : errPct >= 5
        ? '!text-amber-200'
        : '!text-zinc-100'

  return (
    <>
      <div className="pointer-events-auto min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-white/15 bg-gray-950/70 shadow-md backdrop-blur-md">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-1">
          <span
            className={`mb-px shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              mode === 'live'
                ? 'bg-sky-900/70 text-sky-200'
                : 'bg-violet-900/70 text-violet-200'
            }`}
          >
            {mode === 'live' ? 'Live' : 'Sim'}
          </span>
          <button
            type="button"
            onClick={() => setGradeOpen(true)}
            className="mb-px shrink-0 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-100 hover:bg-white/10"
            title="Open design grade (functional and non-functional checklist)"
          >
            Grade
            {gradeEvaluation ? (
              <span className="ml-1 normal-case text-zinc-300">
                · {gradeEvaluation.letter}
              </span>
            ) : null}
          </button>
          {mode === 'simulate' ? (
            <button
              type="button"
              onClick={() => setFlowOpen(true)}
              className="mb-px shrink-0 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-100 hover:bg-white/10"
              title="Open request flow view"
            >
              Flow
            </button>
          ) : null}
          {showWaiting ? (
            <span className="text-xs font-medium text-zinc-300">Waiting…</span>
          ) : aggregates ? (
            <>
              <Stat label="p99" value={fmtMs(aggregates.systemP99Ms)} />
              <Stat
                label="Errors"
                value={fmtPct(errPct)}
                valueClass={errTone}
              />
            </>
          ) : null}
          {mixLabel ? (
            <Stat
              label="Load mix"
              value={mixLabel}
              wrap
              valueClass="!text-amber-100"
              containerClassName="min-w-0 flex-1 basis-full sm:basis-52"
            />
          ) : null}
        </div>

        <div
          className="flex shrink-0 flex-col items-end gap-0 border-white/10 pl-2 sm:border-l sm:pl-3"
          title={ingressHelp}
        >
          <span className="cursor-help text-[10px] font-semibold uppercase tracking-wide text-zinc-200 underline decoration-dotted decoration-zinc-500 underline-offset-2">
            Traffic in
          </span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold tracking-tight text-emerald-400 tabular-nums leading-none">
              {showWaiting ? '—' : fmtRate(throughput)}
            </span>
            {!showWaiting ? (
              <span className="text-xs font-medium text-zinc-300">rps</span>
            ) : null}
          </div>
        </div>
      </div>

      {kpiRows.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 bg-black/25 px-2.5 py-1 backdrop-blur-sm">
          {kpiRows.map((row) => (
            <span
              key={row.id}
              className="inline-flex max-w-full items-center gap-1 rounded bg-gray-900/50 px-1.5 py-0.5 text-[10px] text-gray-300 ring-1 ring-white/5"
              title={row.label}
            >
              <span className="truncate text-zinc-300">{row.label}</span>
              <span className="shrink-0 font-mono font-medium text-gray-100">
                {row.value}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      </div>
      <GradePanel open={gradeOpen} onClose={() => setGradeOpen(false)} />
      <FlowPanel open={flowOpen} onClose={() => setFlowOpen(false)} />
    </>
  )
}
