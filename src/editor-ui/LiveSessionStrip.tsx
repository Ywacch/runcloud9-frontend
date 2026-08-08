import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { startLoadGen, stopLoadGen } from '../lib/api'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import { trackEvent } from '../lib/analytics'
import { fmtMs, fmtPct, fmtRate } from '../lib/format'
import {
  formatSessionMmSs,
  loadMixForTemplate,
  type LoadMixSlice,
} from '../lib/liveSessionStrip'
import { getTopologyFlags } from '../lib/componentRole'
import { computeSystemAggregates } from '../editor-core/domain/systemMetrics'
import { getJourneys, journeyById } from '../lib/requestJourney'
import { templateKpiRows } from '../lib/templateKpis'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'
import { useAuthStore } from '../product/stores/authStore'
import { DataViewPanel } from './DataViewPanel'
import { FlowPanel } from './FlowPanel'
import { LoadgenMetricsPanel } from './LoadgenMetricsPanel'
import { RequestJourneyPanel } from './RequestJourneyPanel'
import { SparkLine } from './SparkLine'
import { SystemMetricsCharts } from './SystemMetricsCharts'

const INGRESS_HELP_LIVE =
  'Requests per second entering the design: live load generator RPS. This is the workload hitting your system.'

const INGRESS_HELP_SIM =
  'Approximate ingress from the local simulation worker (client throughput), not packet capture or production telemetry.'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.2 13.6 13H2.4L8 3.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 7v2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 12.5V8M6.5 12.5V4.5M10.5 12.5V6.5M13.5 12.5V3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LoadMixDonut({
  mix,
  onClick,
}: {
  mix: LoadMixSlice
  onClick?: () => void
}) {
  const size = 36
  const r = 12
  const c = 2 * Math.PI * r
  const readLen = mix.read * c
  const writeLen = Math.max(0, c - readLen)
  const inner = (
    <>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="var(--c9-border)"
          strokeWidth="5"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="var(--c9-info)"
          strokeWidth="5"
          strokeDasharray={`${readLen} ${c}`}
          strokeLinecap="butt"
          transform="rotate(-90 18 18)"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="var(--c9-warning)"
          strokeWidth="5"
          strokeDasharray={`${writeLen} ${c}`}
          strokeDashoffset={-readLen}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="min-w-0 text-[10px] leading-tight text-[var(--c9-muted)]">
        <span className="block truncate text-[var(--c9-text)]">
          {mix.readLabel} ~{mix.readPct}%
        </span>
        <span className="block truncate">
          {mix.writeLabel} ~{mix.writePct}%
        </span>
      </span>
    </>
  )
  const cls =
    'hidden min-w-0 items-center gap-2 xl:flex'
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Request journeys for this template"
        className={`${cls} rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--c9-badge-bg)] active:scale-[0.98]`}
      >
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}

export function LiveSessionStrip() {
  const mode = useCanvasStore((s) => s.mode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const liveSessionEndsAt = useCanvasStore((s) => s.liveSessionEndsAt)
  const session = useAuthStore((s) => s.session)
  const loadgen = useMetricsStore((s) => s.loadgen)
  const streamWarning = useMetricsStore((s) => s.streamWarning)
  const metrics = useMetricsStore((s) => s.metrics)
  const templateMetrics = useMetricsStore((s) => s.templateMetrics)
  const systemSeries = useMetricsStore((s) => s.systemSeries)
  const lastInspector = useSimulationStore((s) => s.lastInspector)
  const simRunning = useSimulationStore((s) => s.running)
  const setActiveTraceId = useLogStore((s) => s.setActiveTraceId)
  const storytelling = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.storytelling : undefined,
  )
  const templateDefaultRps = useTemplateRegistryStore((s) => {
    if (!snapshotTemplateId) return 50
    return s.byId[snapshotTemplateId]?.loadgenDefaultRps ?? 50
  })

  const [remaining, setRemaining] = useState(0)
  const [rps, setRps] = useState(templateDefaultRps)
  const [hasUserSetRps, setHasUserSetRps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadOpen, setLoadOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [dataViewOpen, setDataViewOpen] = useState(false)
  const [journeyUi, setJourneyUi] = useState<{
    open: boolean
    overview: boolean
    id: string | null
  }>({ open: false, overview: false, id: null })
  const loadPopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasUserSetRps) setRps(templateDefaultRps)
  }, [templateDefaultRps, hasUserSetRps])

  useEffect(() => {
    if (!liveSessionEndsAt || mode !== 'live') {
      setRemaining(0)
      return
    }
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((liveSessionEndsAt - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [liveSessionEndsAt, mode])

  useEffect(() => {
    if (mode !== 'live') {
      setDataViewOpen(false)
      setActiveTraceId(null)
      setLoadOpen(false)
    }
  }, [mode, setActiveTraceId])

  useEffect(() => {
    if (!loadOpen) return
    const onPointer = (e: PointerEvent) => {
      const el = loadPopoverRef.current
      if (!el || el.contains(e.target as Node)) return
      setLoadOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [loadOpen])

  const deployStatus = useMemo(() => {
    const list = Object.values(nodes)
    if (list.some((n) => n.status === 'degraded')) return 'Degraded'
    if (list.some((n) => n.status === 'provisioning')) return 'Provisioning'
    return 'Running'
  }, [nodes])

  const statusTone =
    deployStatus === 'Degraded'
      ? 'bg-red-600/90 text-white'
      : deployStatus === 'Provisioning'
        ? 'bg-amber-600/90 text-white'
        : 'bg-emerald-600/90 text-white'

  const mix = useMemo(
    () => loadMixForTemplate(snapshotTemplateId),
    [snapshotTemplateId],
  )

  const aggregates = useMemo(
    () =>
      mode === 'live' || mode === 'simulate'
        ? computeSystemAggregates(
            metrics,
            nodes,
            loadgen,
            mode,
            lastInspector,
            simRunning,
          )
        : null,
    [metrics, nodes, loadgen, mode, lastInspector, simRunning],
  )

  const topology = useMemo(() => getTopologyFlags(nodes), [nodes])

  const kpiRows = useMemo(
    () =>
      mode === 'live' || mode === 'simulate'
        ? templateKpiRows(
            snapshotTemplateId,
            metrics,
            lastInspector,
            nodes,
            loadgen,
            templateMetrics,
            topology,
          )
        : [],
    [
      mode,
      snapshotTemplateId,
      metrics,
      lastInspector,
      nodes,
      loadgen,
      templateMetrics,
      topology,
    ],
  )

  const allJourneys = useMemo(
    () => getJourneys(snapshotTemplateId, topology, storytelling),
    [snapshotTemplateId, topology, storytelling],
  )

  const activeJourney = useMemo(() => {
    if (!journeyUi.open || journeyUi.overview || !journeyUi.id) return null
    return journeyById(snapshotTemplateId, journeyUi.id, topology, storytelling)
  }, [journeyUi, snapshotTemplateId, topology, storytelling])

  const openJourneyOverview = useCallback(() => {
    if (allJourneys.length === 0) return
    setJourneyUi({ open: true, overview: true, id: null })
  }, [allJourneys.length])

  const closeJourney = useCallback(() => {
    setJourneyUi({ open: false, overview: false, id: null })
  }, [])

  const onStartLoad = useCallback(async () => {
    if (!deploymentId) return
    if (!session?.access_token) {
      setError('Please sign in again to run load testing.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await startLoadGen(deploymentId, {
        rps,
        durationSeconds: 0,
        template: snapshotTemplateId ?? '',
      })
      trackEvent('loadgen_started', {
        template: snapshotTemplateId ?? '',
        rps,
        durationSeconds: 0,
      })
    } catch (e) {
      debugAuthError(e, 'loadgen-start')
      setError(
        mapAuthErrorMessage(e, 'Could not start load testing. Please try again.'),
      )
    } finally {
      setBusy(false)
    }
  }, [deploymentId, rps, session?.access_token, snapshotTemplateId])

  const onStopLoad = useCallback(async () => {
    if (!deploymentId) return
    if (!session?.access_token) {
      setError('Please sign in again to run load testing.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await stopLoadGen(deploymentId)
      trackEvent('loadgen_stopped', { template: snapshotTemplateId ?? '' })
    } catch (e) {
      debugAuthError(e, 'loadgen-stop')
      setError(
        mapAuthErrorMessage(e, 'Could not stop load testing. Please try again.'),
      )
    } finally {
      setBusy(false)
    }
  }, [deploymentId, session?.access_token, snapshotTemplateId])

  if (mode !== 'live' && mode !== 'simulate') return null

  const showWaiting = aggregates && !aggregates.hasComponentMetrics
  const throughput = aggregates?.throughputRps ?? 0
  const errPct = aggregates ? aggregates.systemErrorRate * 100 : 0
  const errTone =
    errPct >= 15
      ? 'text-red-300'
      : errPct >= 5
        ? 'text-amber-200'
        : 'text-[var(--c9-text)]'
  const p99Series = systemSeries.map((s) => s.appP99Ms)
  const rpsSeries = systemSeries.map((s) => s.appRps)
  const ingressHelp = mode === 'simulate' ? INGRESS_HELP_SIM : INGRESS_HELP_LIVE
  const sessionLabel =
    mode === 'live' && deploymentId ? deploymentId : 'Simulation'
  const showLoad = mode === 'live' && Boolean(deploymentId)

  return (
    <>
      <div className="pointer-events-auto min-w-0 w-full">
        <div className="overflow-hidden rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 shadow-md shadow-black/20 backdrop-blur-md [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  mode === 'live'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-violet-500/20 text-violet-300'
                }`}
              >
                {mode === 'live' ? 'Live' : 'Sim'}
              </span>
              <span
                className="max-w-[10rem] truncate font-mono text-[11px] text-[var(--c9-text)] sm:max-w-[16rem]"
                title={sessionLabel}
              >
                {sessionLabel}
              </span>
              {mode === 'live' && liveSessionEndsAt ? (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--c9-muted)]">
                  {formatSessionMmSs(remaining)}
                </span>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 items-center divide-x divide-[var(--c9-border)]">
              <div className="flex min-w-0 items-center gap-2 px-3 first:pl-0">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
                    p99
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-[var(--c9-text)]">
                    {showWaiting ? '…' : fmtMs(aggregates?.systemP99Ms)}
                  </p>
                </div>
                {p99Series.length >= 2 ? (
                  <SparkLine
                    data={p99Series}
                    color="var(--c9-info)"
                    width={56}
                    height={22}
                    showArea
                    interactive={false}
                    className="hidden shrink-0 sm:block"
                  />
                ) : null}
              </div>

              <div className="flex min-w-0 items-center gap-2 px-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
                    Errors
                  </p>
                  <p
                    className={`font-mono text-sm font-semibold tabular-nums ${errTone}`}
                  >
                    {showWaiting ? '…' : fmtPct(errPct)}
                  </p>
                </div>
                {errPct < 5 ? (
                  <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <WarnIcon
                    className={`h-4 w-4 shrink-0 ${
                      errPct >= 15 ? 'text-red-300' : 'text-amber-300'
                    }`}
                  />
                )}
              </div>

              <div
                className="flex min-w-0 items-center gap-2 px-3"
                title={ingressHelp}
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
                    Traffic in
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {showWaiting ? '…' : `${fmtRate(throughput)} rps`}
                  </p>
                </div>
                {rpsSeries.length >= 2 ? (
                  <SparkLine
                    data={rpsSeries}
                    color="var(--c9-text)"
                    width={56}
                    height={22}
                    showArea={false}
                    interactive={false}
                    className="hidden shrink-0 md:block"
                  />
                ) : null}
              </div>
            </div>

            {mix ? (
              <LoadMixDonut
                mix={mix}
                onClick={
                  allJourneys.length > 0 ? openJourneyOverview : undefined
                }
              />
            ) : null}

            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
              {showLoad ? (
                <div className="relative" ref={loadPopoverRef}>
                  <button
                    type="button"
                    aria-expanded={loadOpen}
                    onClick={() => setLoadOpen((v) => !v)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white transition-colors active:scale-[0.98] ${
                      loadgen?.active
                        ? 'bg-orange-600 hover:bg-orange-500'
                        : 'bg-[var(--c9-accent)] hover:bg-[var(--c9-accent-hover)]'
                    }`}
                  >
                    Load control
                  </button>
                  {loadOpen ? (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] p-3 shadow-xl">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
                        Target RPS
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={rps}
                        disabled={loadgen?.active}
                        onChange={(e) => {
                          setHasUserSetRps(true)
                          setRps(Math.max(1, Number(e.target.value) || 1))
                        }}
                        className={`mt-1 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1 font-mono text-sm text-[var(--c9-text)] ${
                          loadgen?.active ? 'cursor-not-allowed opacity-50' : ''
                        }`}
                      />
                      {loadgen?.active && loadgen.targetRps > 0 ? (
                        <p className="mt-1 text-[10px] text-[var(--c9-muted)]">
                          Running at {fmtRate(loadgen.targetRps)} rps
                          {loadgen.totalRequests != null
                            ? ` · ${loadgen.totalRequests.toLocaleString()} req`
                            : ''}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (loadgen?.active) void onStopLoad()
                          else void onStartLoad()
                        }}
                        className={`mt-2 w-full rounded px-2 py-1.5 text-[11px] font-semibold text-white active:scale-[0.98] ${
                          loadgen?.active
                            ? 'bg-orange-600 hover:bg-orange-500'
                            : 'bg-[var(--c9-accent)] hover:bg-[var(--c9-accent-hover)]'
                        } disabled:opacity-60`}
                      >
                        {busy
                          ? loadgen?.active
                            ? 'Stopping…'
                            : 'Starting…'
                          : loadgen?.active
                            ? 'Stop load'
                            : 'Start load'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === 'live' ? (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusTone}`}
                >
                  Status: {deployStatus}
                </span>
              ) : null}

              <button
                type="button"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-text)] transition-colors hover:bg-[var(--c9-badge-bg)] active:scale-[0.98]"
              >
                <ChartIcon className="h-3.5 w-3.5 text-[var(--c9-muted)]" />
                Detailed metrics
              </button>
            </div>
          </div>
        </div>

        {detailsOpen ? (
          <div className="mt-1.5 space-y-2 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 p-2.5 shadow-md backdrop-blur-md">
            <div className="flex flex-wrap gap-1.5">
              {mode === 'simulate' ? (
                <button
                  type="button"
                  onClick={() => setFlowOpen(true)}
                  className="rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-text)]"
                >
                  Flow
                </button>
              ) : null}
              {mode === 'live' ? (
                <button
                  type="button"
                  onClick={() => setDataViewOpen(true)}
                  className="rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-text)]"
                >
                  Playground
                </button>
              ) : null}
              {kpiRows.map((row) => (
                <span
                  key={row.id}
                  className="inline-flex max-w-full items-center gap-1 rounded bg-[var(--c9-bg)]/50 px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)] ring-1 ring-[var(--c9-border)]"
                  title={row.label}
                >
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 font-mono font-medium text-[var(--c9-text)]">
                    {row.value}
                  </span>
                </span>
              ))}
            </div>
            {mode === 'live' ? (
              <>
                <LoadgenMetricsPanel />
                <SystemMetricsCharts />
              </>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-1.5 rounded border border-red-700/50 bg-red-950/65 px-2 py-1 text-xs font-medium text-red-100">
            {error}
          </p>
        ) : null}
        {streamWarning ? (
          <p className="mt-1.5 rounded border border-amber-700/50 bg-amber-950/65 px-2 py-1 text-xs font-medium text-amber-100">
            {streamWarning}
          </p>
        ) : null}
      </div>

      <FlowPanel open={flowOpen} onClose={() => setFlowOpen(false)} />
      <RequestJourneyPanel
        open={journeyUi.open}
        overview={journeyUi.overview}
        journey={activeJourney}
        allJourneys={allJourneys}
        nodes={nodes}
        metrics={metrics}
        onClose={closeJourney}
        onSelectJourney={(id) => {
          if (id === '__overview__') {
            setJourneyUi({ open: true, overview: true, id: null })
          } else {
            setJourneyUi({ open: true, overview: false, id })
          }
        }}
      />
      {mode === 'live' ? (
        <DataViewPanel
          open={dataViewOpen}
          onClose={() => setDataViewOpen(false)}
        />
      ) : null}
    </>
  )
}
