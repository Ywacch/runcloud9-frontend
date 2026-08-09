import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { startLoadGen, stopLoadGen } from '../lib/api'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import { trackEvent } from '../lib/analytics'
import { fmtInt, fmtMs, fmtPct, fmtRate } from '../lib/format'
import { useDevLiveStripVisible } from '../lib/devCanvasTools'
import { useLiveChromeStore } from '../lib/liveChromeStore'
import {
  DEV_LIVE_STRIP_PREVIEW,
  formatSessionMmSs,
  loadMixSegmentsForTemplate,
  mixSegmentShowsLabel,
  type LoadMixSegment,
} from '../lib/liveSessionStrip'
import { getTopologyFlags } from '../lib/componentRole'
import { computeSystemAggregates } from '../editor-core/domain/systemMetrics'
import { getJourneys, journeyById } from '../lib/requestJourney'
import { kpiChipIsAlert, templateKpiRows } from '../lib/templateKpis'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'
import { useAuthStore } from '../product/stores/authStore'
import { RequestJourneyPanel } from './RequestJourneyPanel'

const INGRESS_HELP_LIVE =
  'Requests per second entering the design: live load generator RPS. This is the workload hitting your system.'

const INGRESS_HELP_SIM =
  'Approximate ingress from the local simulation worker (client throughput), not packet capture or production telemetry.'

const CHIPS_KEY = 'runcloud9.liveKpiChipsOpen'

const chromeBtn =
  'rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] px-2.5 py-1 text-[12px] text-[var(--c9-text)] transition-colors duration-150 hover:bg-[var(--c9-bg-card)] active:scale-[0.98]'

function readChipsOpen(): boolean {
  try {
    return localStorage.getItem(CHIPS_KEY) !== '0'
  } catch {
    return true
  }
}

export function LiveSessionStrip() {
  const stripVisible = useDevLiveStripVisible()
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
  const metricsDrawerOpen = useLiveChromeStore((s) => s.metricsDrawerOpen)
  const setMetricsDrawerOpen = useLiveChromeStore((s) => s.setMetricsDrawerOpen)

  const [remaining, setRemaining] = useState(0)
  const [rps, setRps] = useState(templateDefaultRps)
  const [hasUserSetRps, setHasUserSetRps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadOpen, setLoadOpen] = useState(false)
  const [chipsOpen, setChipsOpen] = useState(readChipsOpen)
  const [previewLoadActive, setPreviewLoadActive] = useState(true)
  const [previewTotal, setPreviewTotal] = useState<number>(
    DEV_LIVE_STRIP_PREVIEW.totalRequests,
  )
  const [journeyUi, setJourneyUi] = useState<{
    open: boolean
    overview: boolean
    id: string | null
  }>({ open: false, overview: false, id: null })
  const loadBtnRef = useRef<HTMLButtonElement>(null)
  const loadPanelRef = useRef<HTMLDivElement>(null)
  const [loadPos, setLoadPos] = useState<{ top: number; right: number } | null>(
    null,
  )

  useEffect(() => {
    if (!hasUserSetRps) {
      setRps(
        import.meta.env.DEV && mode === 'design'
          ? DEV_LIVE_STRIP_PREVIEW.targetRps
          : templateDefaultRps,
      )
    }
  }, [templateDefaultRps, hasUserSetRps, mode])

  useEffect(() => {
    if (import.meta.env.DEV && mode === 'design') {
      const end = Date.now() + DEV_LIVE_STRIP_PREVIEW.remainingSeconds * 1000
      const tick = () => {
        setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)))
      }
      tick()
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    }
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
    if (mode !== 'live' && !(import.meta.env.DEV && mode === 'design')) {
      setActiveTraceId(null)
      setLoadOpen(false)
      setMetricsDrawerOpen(false)
    }
  }, [mode, setActiveTraceId, setMetricsDrawerOpen])

  useLayoutEffect(() => {
    if (!loadOpen) {
      setLoadPos(null)
      return
    }
    const place = () => {
      const btn = loadBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      setLoadPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [loadOpen])

  useEffect(() => {
    if (!loadOpen) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (loadBtnRef.current?.contains(t) || loadPanelRef.current?.contains(t)) {
        return
      }
      setLoadOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoadOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [loadOpen])

  const deployStatus = useMemo(() => {
    const list = Object.values(nodes)
    if (list.some((n) => n.status === 'degraded')) return 'Degraded'
    if (list.some((n) => n.status === 'provisioning')) return 'Provisioning'
    return 'Running'
  }, [nodes])

  const statusDot =
    deployStatus === 'Degraded'
      ? 'bg-red-400'
      : deployStatus === 'Provisioning'
        ? 'bg-amber-400'
        : 'bg-emerald-400'

  const devDesignPreview = import.meta.env.DEV && mode === 'design'
  const mixSegments = useMemo(
    () =>
      loadMixSegmentsForTemplate(
        devDesignPreview ? DEV_LIVE_STRIP_PREVIEW.templateId : snapshotTemplateId,
      ),
    [devDesignPreview, snapshotTemplateId],
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
      devDesignPreview
        ? DEV_LIVE_STRIP_PREVIEW.kpiRows.map((row) => ({ ...row }))
        : mode === 'live' || mode === 'simulate'
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
      devDesignPreview,
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
    if (devDesignPreview) {
      setPreviewLoadActive(true)
      return
    }
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
  }, [deploymentId, rps, session?.access_token, snapshotTemplateId, devDesignPreview])

  const onStopLoad = useCallback(async () => {
    if (devDesignPreview) {
      setPreviewLoadActive(false)
      return
    }
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
  }, [deploymentId, session?.access_token, snapshotTemplateId, devDesignPreview])

  useEffect(() => {
    if (!devDesignPreview || !previewLoadActive) return
    const id = window.setInterval(() => {
      setPreviewTotal((t) => t + rps)
    }, 1000)
    return () => window.clearInterval(id)
  }, [devDesignPreview, previewLoadActive, rps])

  if (mode !== 'live' && mode !== 'simulate' && !devDesignPreview) return null
  if (!stripVisible) return null

  const showWaiting = !devDesignPreview && Boolean(aggregates && !aggregates.hasComponentMetrics)
  const throughput = devDesignPreview
    ? DEV_LIVE_STRIP_PREVIEW.throughputRps
    : (aggregates?.throughputRps ?? 0)
  const errPct = devDesignPreview
    ? DEV_LIVE_STRIP_PREVIEW.errPct
    : aggregates
      ? aggregates.systemErrorRate * 100
      : 0
  const p99Ms = devDesignPreview
    ? DEV_LIVE_STRIP_PREVIEW.p99Ms
    : aggregates?.systemP99Ms
  const errTone =
    errPct >= 15
      ? 'text-red-300'
      : errPct >= 5
        ? 'text-amber-200'
        : 'text-[var(--c9-text)]'
  const ingressHelp = mode === 'simulate' ? INGRESS_HELP_SIM : INGRESS_HELP_LIVE
  const showLoad =
    (mode === 'live' && Boolean(deploymentId)) || devDesignPreview
  const showLiveChrome = mode === 'live' || devDesignPreview
  const statusLabel = devDesignPreview ? 'Running' : deployStatus
  const pulseOk =
    showLiveChrome && (devDesignPreview || deployStatus === 'Running')
  const loadRunning = devDesignPreview
    ? previewLoadActive
    : Boolean(loadgen?.active)
  const runningRps = devDesignPreview
    ? rps
    : loadgen?.targetRps && loadgen.targetRps > 0
      ? loadgen.targetRps
      : rps
  const runningTotal = devDesignPreview
    ? previewTotal
    : (loadgen?.totalRequests ?? 0)
  const sessionTitle =
    mode === 'live' && deploymentId
      ? deploymentId
      : mode === 'simulate'
        ? 'Simulation'
        : `${DEV_LIVE_STRIP_PREVIEW.deploymentId} (DEV preview, press \` to hide)`

  const toggleChips = () => {
    setChipsOpen((open) => {
      const next = !open
      try {
        localStorage.setItem(CHIPS_KEY, next ? '1' : '0')
      } catch {
        /* private mode / quota */
      }
      return next
    })
  }

  return (
    <>
      <div className="relative z-30 shrink-0 overflow-visible">
        <div
          className="flex h-11 min-w-0 items-center gap-3 overflow-visible border-b border-[var(--c9-border)] bg-[var(--c9-bg-surface)] px-3"
          title={sessionTitle}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--c9-text)]">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${statusDot} ${
                  pulseOk ? 'animate-pulse' : ''
                }`}
                title={statusLabel}
                aria-label={statusLabel}
              />
              {showLiveChrome ? 'Live' : 'Sim'}
              {showLiveChrome ? (
                <span className="hidden font-mono text-[11px] tabular-nums text-[var(--c9-muted)] sm:inline">
                  {formatSessionMmSs(remaining)}
                </span>
              ) : null}
            </span>

            <span className="shrink-0 text-[12px] text-[var(--c9-muted)]">
              P99 latency:{' '}
              <span className="font-mono font-semibold tabular-nums text-[var(--c9-text)]">
                {showWaiting ? '…' : fmtMs(p99Ms)}
              </span>
            </span>
            <span className="shrink-0 text-[12px] text-[var(--c9-muted)]">
              Error rate:{' '}
              <span className={`font-mono font-semibold tabular-nums ${errTone}`}>
                {showWaiting ? '…' : fmtPct(errPct)}
              </span>
            </span>

            {mixSegments ? (
              <MixBar
                segments={mixSegments}
                onClick={allJourneys.length > 0 ? openJourneyOverview : undefined}
              />
            ) : null}

            <span
              className="hidden shrink-0 text-[12px] text-[var(--c9-muted)] lg:inline"
              title={ingressHelp}
            >
              Traffic in rate:{' '}
              <span className="font-mono font-semibold tabular-nums text-[var(--c9-text)]">
                {showWaiting ? '…' : fmtRate(throughput)} rps
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showLoad ? (
              <button
                ref={loadBtnRef}
                type="button"
                aria-expanded={loadOpen}
                aria-haspopup="dialog"
                onClick={() => setLoadOpen((v) => !v)}
                className={chromeBtn}
              >
                Load control
              </button>
            ) : null}

            <button
              type="button"
              aria-expanded={metricsDrawerOpen}
              onClick={() => setMetricsDrawerOpen(!metricsDrawerOpen)}
              className={chromeBtn}
            >
              Detailed metrics
            </button>

            {loadRunning && showLoad ? (
              <>
                <span className="text-[12px] text-[var(--c9-muted)]">
                  RPS{' '}
                  <span className="font-mono font-semibold tabular-nums text-[var(--c9-text)]">
                    {fmtRate(runningRps)}
                  </span>
                  {' | '}
                  Total{' '}
                  <span className="font-mono font-semibold tabular-nums text-[var(--c9-text)]">
                    {fmtInt(runningTotal)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onStopLoad()}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-red-500 active:scale-[0.98] disabled:opacity-60"
                >
                  Stop
                </button>
              </>
            ) : null}
          </div>
        </div>

        {kpiRows.length > 0 ? (
          <div
            className={`pointer-events-none absolute top-full left-0 z-20 ${
              metricsDrawerOpen ? `right-[22rem]` : 'right-0'
            }`}
          >
            <div className="pointer-events-auto flex items-start gap-2 px-3 pt-1.5">
              <div
                className={`flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto transition-opacity duration-200 ${
                  chipsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                {kpiRows.map((row) => {
                  const alert = kpiChipIsAlert(row)
                  return (
                    <span
                      key={row.id}
                      title={row.label}
                      className={`inline-flex shrink-0 items-baseline gap-1.5 rounded-md border px-2.5 py-1 text-[12px] ${
                        alert
                          ? 'border-red-500/60 bg-[var(--c9-bg-subtle)] text-[var(--c9-text)]'
                          : 'border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] text-[var(--c9-text)]'
                      }`}
                    >
                      <span className="text-[var(--c9-muted)]">{row.label}:</span>
                      <span
                        className={`font-mono tabular-nums ${
                          alert ? 'text-red-300' : 'text-[var(--c9-text)]'
                        }`}
                      >
                        {row.value}
                      </span>
                    </span>
                  )
                })}
              </div>
              <button
                type="button"
                aria-label={chipsOpen ? 'Hide metric chips' : 'Show metric chips'}
                aria-expanded={chipsOpen}
                onClick={toggleChips}
                className="mt-0.5 shrink-0 rounded p-0.5 text-[var(--c9-muted)] transition-transform duration-150 hover:text-[var(--c9-text)] active:scale-[0.96]"
              >
                <ChevronIcon open={chipsOpen} />
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="border-b border-red-700/40 bg-red-950/65 px-3 py-1.5 text-xs font-medium text-red-100">
            {error}
          </p>
        ) : null}
        {streamWarning ? (
          <p className="border-b border-amber-700/40 bg-amber-950/65 px-3 py-1.5 text-xs font-medium text-amber-100">
            {streamWarning}
          </p>
        ) : null}
      </div>

      {loadOpen && loadPos && showLoad
        ? createPortal(
            <div
              ref={loadPanelRef}
              role="dialog"
              aria-label="Load control"
              className="fixed z-[80] w-72 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
              style={{ top: loadPos.top, right: loadPos.right }}
            >
              <label
                htmlFor="live-load-rps"
                className="block text-[12px] font-semibold text-[var(--c9-text)]"
              >
                RPS
              </label>
              <input
                id="live-load-rps"
                type="number"
                min={1}
                max={500}
                autoFocus
                value={rps}
                onChange={(e) => {
                  setHasUserSetRps(true)
                  setRps(Math.max(1, Number(e.target.value) || 1))
                }}
                className="mt-2 w-full rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg-surface)] px-3 py-2 font-mono text-base text-[var(--c9-text)]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (loadRunning) void onStopLoad()
                  else void onStartLoad()
                }}
                className={`mt-3 w-full rounded-md px-3 py-2 text-[13px] font-medium text-white active:scale-[0.98] ${
                  loadRunning
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-emerald-700 hover:bg-emerald-600'
                } disabled:opacity-60`}
              >
                {busy
                  ? loadRunning
                    ? 'Stopping…'
                    : 'Starting…'
                  : loadRunning
                    ? 'Stop load'
                    : 'Start load'}
              </button>
            </div>,
            document.body,
          )
        : null}

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
    </>
  )
}

function MixBar({
  segments,
  onClick,
}: {
  segments: LoadMixSegment[]
  onClick?: () => void
}) {
  const inner = segments.map((seg) => (
    <span
      key={seg.id}
      className="flex min-w-[4px] items-center justify-center overflow-hidden px-1.5 text-[10px] font-medium leading-none text-white/90"
      style={{
        flexGrow: Math.max(seg.pct, 2),
        flexBasis: 0,
        backgroundColor: seg.color,
      }}
      title={`${seg.label} ${seg.pct}%`}
    >
      {mixSegmentShowsLabel(seg.pct) ? (
        <span className="truncate">
          {seg.label} {seg.pct}%
        </span>
      ) : null}
    </span>
  ))
  const className =
    'flex h-5 min-w-0 max-w-[22rem] flex-1 overflow-hidden rounded-[4px]'
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Request journeys for this template"
        className={className}
      >
        {inner}
      </button>
    )
  }
  return <div className={className}>{inner}</div>
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
