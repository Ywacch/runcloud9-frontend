import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'
import { startLoadGen, stopLoadGen, updateLoadGen, getTemplateLoadgen } from '../lib/api'
import { ApiError } from '../lib/apiError'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import { SHOW_SIMULATION_UI } from '../lib/featureFlags'
import { trackEvent } from '../lib/analytics'
import { fmtInt, fmtMs, fmtPct, fmtRate } from '../lib/format'
import { useDevLiveStripVisible } from '../lib/devCanvasTools'
import { useLiveChromeStore } from '../lib/liveChromeStore'
import {
  DEV_LIVE_STRIP_PREVIEW,
  formatSessionMmSs,
  loadMixSegmentsForSession,
  loadMixSegmentsFromDistribution,
  mixSegmentShowsLabel,
  sessionHealth,
  type LoadMixSegment,
} from '../lib/liveSessionStrip'
import {
  defaultActorParams,
  defaultScheduleId,
  DEV_LOADGEN_CONFIG,
  formatActorParamLabel,
  formatSchedulePhaseSummary,
  readLoadSessionPrefs,
  writeLoadSessionPrefs,
} from '../lib/loadSessionPrefs'
import type { LoadgenActorParamSpec, LoadgenEndpointSpec } from '../lib/api'
import {
  defaultEndpointPercents,
  distributionKey,
  distributionSnapshot,
  distributionToPercents,
  endpointMixLabel,
  percentsToDistribution,
  redistributePercents,
} from '../lib/trafficMix'
import { getTopologyFlags } from '../lib/componentRole'
import { computeSystemAggregates } from '../editor-core/domain/systemMetrics'
import { getJourneys, journeyById } from '../lib/requestJourney'
import {
  hudKpiRows,
  kpiChipIsAlert,
  templateKpiRows,
} from '../lib/templateKpis'
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

const hudChromeBtn =
  'c9-hud-btn inline-flex items-center gap-[0.45rem] rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] px-[0.7rem] py-[0.3rem] text-[12px] text-[var(--c9-text)] transition-colors duration-150 hover:bg-[var(--c9-bg-card)] focus-visible:outline-none focus-visible:shadow-[var(--c9-shadow-focus)] active:scale-[0.98]'

function readChipsOpen(): boolean {
  try {
    return localStorage.getItem(CHIPS_KEY) === '1'
  } catch {
    return false
  }
}

export function LiveSessionStrip() {
  const stripVisible = useDevLiveStripVisible()
  const mode = useCanvasStore((s) => s.mode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const liveSessionStartedAt = useCanvasStore((s) => s.liveSessionStartedAt)
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
  const loadgenConfig = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.loadgenConfigById[snapshotTemplateId] : undefined,
  )
  const setLoadgenConfig = useTemplateRegistryStore((s) => s.setLoadgenConfig)
  const devDesignPreview = import.meta.env.DEV && mode === 'design'
  const resolvedLoadgenConfig = devDesignPreview ? DEV_LOADGEN_CONFIG : loadgenConfig
  const mixTemplateId = devDesignPreview
    ? DEV_LIVE_STRIP_PREVIEW.templateId
    : snapshotTemplateId
  const mixStorytelling = useTemplateRegistryStore((s) =>
    mixTemplateId ? s.byId[mixTemplateId]?.storytelling : undefined,
  )
  const templateDefaultRps = useTemplateRegistryStore((s) => {
    if (!snapshotTemplateId) return 50
    return s.byId[snapshotTemplateId]?.loadgenDefaultRps ?? 50
  })
  const metricsDrawerOpen = useLiveChromeStore((s) => s.metricsDrawerOpen)
  const setMetricsDrawerOpen = useLiveChromeStore((s) => s.setMetricsDrawerOpen)

  const [remaining, setRemaining] = useState(0)
  const [rps, setRps] = useState(templateDefaultRps)
  const [scheduleId, setScheduleId] = useState('')
  const [actorParams, setActorParams] = useState<Record<string, number>>({})
  const [mixPercents, setMixPercents] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastPatchRef = useRef<{ rps: number; distSnap: string } | null>(null)
  const patchTimerRef = useRef<number | null>(null)
  const loadgenStartedAtRef = useRef<number | null>(null)
  const prevLiveSessionRef = useRef<{ mode: typeof mode; deploymentId: string | null }>({
    mode,
    deploymentId,
  })
  const [loadgenPrompt, setLoadgenPrompt] = useState(false)
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
  const [loadPos, setLoadPos] = useState<{
    top: number
    right: number
    maxHeight: number
  } | null>(null)

  useEffect(() => {
    if (devDesignPreview) return
    if (!snapshotTemplateId || loadgenConfig) return
    let cancelled = false
    getTemplateLoadgen(snapshotTemplateId)
      .then((cfg) => {
        if (!cancelled) setLoadgenConfig(snapshotTemplateId, cfg)
      })
      .catch(() => {
        /* template may have no loadgen config */
      })
    return () => {
      cancelled = true
    }
  }, [snapshotTemplateId, loadgenConfig, setLoadgenConfig, devDesignPreview])

  useEffect(() => {
    const cfg = resolvedLoadgenConfig
    const endpoints = cfg?.endpoints ?? []
    const prefs = deploymentId ? readLoadSessionPrefs(deploymentId) : null
    if (prefs) {
      setRps(prefs.rps)
      setScheduleId(prefs.scheduleId ?? defaultScheduleId(cfg))
      setActorParams(prefs.actorParams ?? defaultActorParams(cfg))
      if (endpoints.length > 1 && prefs.distribution) {
        setMixPercents(distributionToPercents(endpoints, prefs.distribution))
      } else if (endpoints.length > 1) {
        setMixPercents(defaultEndpointPercents(endpoints))
      } else {
        setMixPercents([])
      }
      lastPatchRef.current = prefs.distribution
        ? { rps: prefs.rps, distSnap: distributionSnapshot(prefs.distribution) }
        : { rps: prefs.rps, distSnap: '' }
      return
    }
    const defaultRps =
      cfg?.defaultRps ??
      (devDesignPreview ? DEV_LIVE_STRIP_PREVIEW.targetRps : templateDefaultRps)
    setRps(defaultRps)
    setScheduleId(defaultScheduleId(cfg))
    setActorParams(defaultActorParams(cfg))
    if (endpoints.length > 1) {
      setMixPercents(defaultEndpointPercents(endpoints))
    } else {
      setMixPercents([])
    }
    lastPatchRef.current = null
  }, [
    deploymentId,
    snapshotTemplateId,
    resolvedLoadgenConfig,
    devDesignPreview,
    templateDefaultRps,
  ])

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
      setLoadgenPrompt(false)
    }
  }, [mode, setActiveTraceId, setMetricsDrawerOpen])

  useEffect(() => {
    const prev = prevLiveSessionRef.current
    const enteredLive =
      mode === 'live' &&
      Boolean(deploymentId) &&
      (prev.mode !== 'live' || prev.deploymentId !== deploymentId)
    if (enteredLive && !loadgen?.active) {
      setLoadgenPrompt(true)
    }
    if (mode !== 'live' || loadgen?.active) {
      setLoadgenPrompt(false)
    }
    prevLiveSessionRef.current = { mode, deploymentId }
  }, [deploymentId, loadgen?.active, mode])

  useLayoutEffect(() => {
    if (!loadOpen) {
      setLoadPos(null)
      return
    }
    const place = () => {
      const btn = loadBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const gap = 8
      const margin = 12
      const availableBelow = window.innerHeight - r.bottom - gap - margin
      const maxHeight = Math.max(
        220,
        Math.min(window.innerHeight * 0.7, availableBelow),
      )
      setLoadPos({
        top: r.bottom + gap,
        right: Math.max(margin, window.innerWidth - r.right),
        maxHeight,
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

  const topology = useMemo(() => getTopologyFlags(nodes), [nodes])

  const allJourneys = useMemo(
    () => getJourneys(snapshotTemplateId, topology, storytelling),
    [snapshotTemplateId, topology, storytelling],
  )

  const mixSegments = useMemo(() => {
    if (
      !devDesignPreview &&
      loadgen?.active &&
      loadgen.distribution &&
      Object.keys(loadgen.distribution).length > 0
    ) {
      const fromDist = loadMixSegmentsFromDistribution(
        loadgen.distribution,
        allJourneys,
      )
      if (fromDist) return fromDist
    }
    return loadMixSegmentsForSession(mixTemplateId, topology, mixStorytelling)
  }, [
    devDesignPreview,
    loadgen,
    allJourneys,
    mixTemplateId,
    topology,
    mixStorytelling,
  ])

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

  const kpiRows = useMemo(() => {
    const raw = devDesignPreview
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
        : []
    return hudKpiRows(raw)
  }, [
    devDesignPreview,
    mode,
    snapshotTemplateId,
    metrics,
    lastInspector,
    nodes,
    loadgen,
    templateMetrics,
    topology,
  ])

  const loadRunning = devDesignPreview
    ? previewLoadActive
    : Boolean(loadgen?.active)

  const selectedSchedule = resolvedLoadgenConfig?.schedules?.find(
    (s) => s.id === scheduleId,
  )
  const schedulePhaseSummary = formatSchedulePhaseSummary(selectedSchedule?.phases)
  const visibleActorParams = (resolvedLoadgenConfig?.params ?? []).filter(
    (p) => p.key !== 'tier',
  )
  const loadEndpoints = resolvedLoadgenConfig?.endpoints ?? []
  const hasMixControls = loadEndpoints.length > 1
  const hasSchedulePicker = (resolvedLoadgenConfig?.schedules?.length ?? 0) > 0

  const mixDistribution = useMemo(() => {
    if (!hasMixControls) return undefined
    return percentsToDistribution(loadEndpoints, mixPercents)
  }, [hasMixControls, loadEndpoints, mixPercents])

  const buildSessionPrefs = useCallback(() => {
    const prefs = { rps, scheduleId, actorParams }
    if (mixDistribution) {
      return { ...prefs, distribution: mixDistribution }
    }
    return prefs
  }, [rps, scheduleId, actorParams, mixDistribution])

  useEffect(() => {
    if (!deploymentId || loadRunning) return
    writeLoadSessionPrefs(deploymentId, buildSessionPrefs())
  }, [deploymentId, buildSessionPrefs, loadRunning])

  useEffect(() => {
    if (devDesignPreview || !loadRunning || !deploymentId) return
    const distSnap = mixDistribution ? distributionSnapshot(mixDistribution) : ''
    const last = lastPatchRef.current
    const rpsChanged = last?.rps !== rps
    const mixChanged = last?.distSnap !== distSnap
    if (!rpsChanged && !mixChanged) return

    if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current)
    patchTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (!session?.access_token) return
        const snap = mixDistribution ? distributionSnapshot(mixDistribution) : ''
        const prev = lastPatchRef.current
        try {
          const patch: { rps?: number; distribution?: Record<string, number> } = {}
          if (prev?.rps !== rps) patch.rps = rps
          if (mixDistribution && prev?.distSnap !== snap) {
            patch.distribution = mixDistribution
          }
          if (Object.keys(patch).length === 0) return
          await updateLoadGen(deploymentId, patch)
          lastPatchRef.current = { rps, distSnap: snap }
          writeLoadSessionPrefs(deploymentId, buildSessionPrefs())
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            setError('Load is not running.')
          } else {
            debugAuthError(e, 'loadgen-patch')
            setError(
              mapAuthErrorMessage(e, 'Could not update load settings. Please try again.'),
            )
          }
        }
      })()
    }, 300)
    return () => {
      if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current)
    }
  }, [
    rps,
    mixDistribution,
    loadRunning,
    deploymentId,
    devDesignPreview,
    session?.access_token,
    buildSessionPrefs,
  ])

  const activeJourney = useMemo(() => {
    if (!journeyUi.open || journeyUi.overview || !journeyUi.id) return null
    return journeyById(snapshotTemplateId, journeyUi.id, topology, storytelling)
  }, [journeyUi, snapshotTemplateId, topology, storytelling])

  const openJourneyOverview = useCallback(() => {
    if (allJourneys.length === 0) return
    trackEvent('journey_panel_opened', {
      template: snapshotTemplateId ?? 'unknown',
      context: 'live',
    })
    setJourneyUi({ open: true, overview: true, id: null })
  }, [allJourneys.length, snapshotTemplateId])

  const closeJourney = useCallback(() => {
    setJourneyUi((prev) => {
      if (prev.open) {
        trackEvent('journey_panel_closed', {
          template: snapshotTemplateId ?? 'unknown',
          context: 'live',
          selected: Boolean(prev.id),
          ...(prev.id ? { journeyId: prev.id } : {}),
        })
      }
      return { open: false, overview: false, id: null }
    })
  }, [snapshotTemplateId])

  const onStartLoad = useCallback(async () => {
    setLoadgenPrompt(false)
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
        scheduleId: scheduleId || undefined,
        actorParams:
          Object.keys(actorParams).length > 0 ? actorParams : undefined,
        distribution: mixDistribution,
      })
      lastPatchRef.current = {
        rps,
        distSnap: mixDistribution ? distributionSnapshot(mixDistribution) : '',
      }
      writeLoadSessionPrefs(deploymentId, buildSessionPrefs())
      loadgenStartedAtRef.current = Date.now()
      trackEvent('loadgen_started', {
        template: snapshotTemplateId ?? '',
        rps,
        durationSeconds: 0,
        scheduleId: scheduleId || undefined,
        ...(deploymentId ? { deploymentId } : {}),
        ...(liveSessionStartedAt
          ? {
              time_to_loadgen_ms: Math.max(
                0,
                Date.now() - liveSessionStartedAt,
              ),
            }
          : {}),
      })
    } catch (e) {
      debugAuthError(e, 'loadgen-start')
      setError(
        mapAuthErrorMessage(e, 'Could not start load testing. Please try again.'),
      )
    } finally {
      setBusy(false)
    }
  }, [
    deploymentId,
    rps,
    scheduleId,
    actorParams,
    session?.access_token,
    snapshotTemplateId,
    liveSessionStartedAt,
    devDesignPreview,
    mixDistribution,
    buildSessionPrefs,
  ])

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
      const liveSeconds =
        loadgenStartedAtRef.current != null
          ? Math.max(
              0,
              Math.floor((Date.now() - loadgenStartedAtRef.current) / 1000),
            )
          : 0
      loadgenStartedAtRef.current = null
      trackEvent('loadgen_stopped', {
        template: snapshotTemplateId ?? '',
        liveSeconds,
        ...(deploymentId ? { deploymentId } : {}),
      })
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

  if (mode === 'simulate' && !SHOW_SIMULATION_UI) return null
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
  const health = sessionHealth({
    errPct,
    p99Ms,
    nodeStatus: devDesignPreview ? 'Running' : deployStatus,
  })
  const healthTone =
    health === 'critical'
      ? 'text-red-300'
      : health === 'degraded'
        ? 'text-amber-200'
        : 'text-[var(--c9-text)]'
  const statusDot =
    health === 'critical'
      ? 'bg-red-400'
      : health === 'degraded'
        ? 'bg-amber-400'
        : 'bg-emerald-400'
  const showLoad =
    (mode === 'live' && Boolean(deploymentId)) || devDesignPreview
  const showLiveChrome = mode === 'live' || devDesignPreview
  const statusLabel =
    health === 'critical'
      ? 'Failing'
      : health === 'degraded'
        ? 'Degraded'
        : devDesignPreview
          ? 'Running'
          : deployStatus
  const pulseOk = showLiveChrome && health === 'ok'
  const runningRps = devDesignPreview
    ? rps
    : loadgen?.targetRps && loadgen.targetRps > 0
      ? loadgen.targetRps
      : rps
  const runningTotal = devDesignPreview
    ? previewTotal
    : (loadgen?.totalRequests ?? 0)
  const loadPhaseLabel =
    !devDesignPreview && loadgen?.currentPhase ? loadgen.currentPhase : null
  const sessionTitle =
    mode === 'live' && deploymentId
      ? deploymentId
      : mode === 'simulate'
        ? 'Simulation'
        : `${DEV_LIVE_STRIP_PREVIEW.deploymentId} (DEV preview, press \` to hide)`

  const showLoadgenPrompt = loadgenPrompt && showLoad && !loadRunning

  const toggleChips = () => {
    setChipsOpen((open) => {
      const next = !open
      try {
        localStorage.setItem(CHIPS_KEY, next ? '1' : '0')
      } catch {
        /* private mode / quota */
      }
      window.setTimeout(() => requestCanvasFit(), 200)
      return next
    })
  }

  const alertKpi = kpiRows.find((row) => kpiChipIsAlert(row))

  return (
    <>
      <div className="relative z-30 shrink-0 overflow-visible">

        <div
          className="flex h-11 min-w-0 items-center gap-3 overflow-visible border-b border-[var(--c9-border)] bg-[var(--c9-bg-surface)] px-3"
          title={sessionTitle}
        >
          <div className="flex shrink-0 items-center gap-3">
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
              P99{' '}
              <span className={`font-mono font-semibold tabular-nums ${healthTone}`}>
                {showWaiting ? '…' : fmtMs(p99Ms)}
              </span>
            </span>
            <span className="shrink-0 text-[12px] text-[var(--c9-muted)]">
              Err{' '}
              <span className={`font-mono font-semibold tabular-nums ${healthTone}`}>
                {showWaiting ? '…' : fmtPct(errPct)}
              </span>
            </span>
            {alertKpi ? (
              <span className="shrink-0 text-[12px] text-red-300">
                {alertKpi.label}{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {alertKpi.value}
                </span>
              </span>
            ) : null}
            {SHOW_SIMULATION_UI && mode === 'simulate' ? (
              <span
                className="shrink-0 text-[12px] text-[var(--c9-muted)]"
                title={INGRESS_HELP_SIM}
              >
                In{' '}
                <span className="font-mono font-semibold tabular-nums text-[var(--c9-text)]">
                  {showWaiting ? '…' : fmtRate(throughput)}
                </span>
              </span>
            ) : null}
          </div>

          {mixSegments ? (
            <MixBar
              segments={mixSegments}
              onClick={allJourneys.length > 0 ? openJourneyOverview : undefined}
            />
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showLoad ? (
              <button
                ref={loadBtnRef}
                type="button"
                aria-expanded={loadOpen}
                aria-haspopup="dialog"
                aria-label={
                  showLoadgenPrompt
                    ? 'Start load — deployment is ready'
                    : 'Load control'
                }
                onClick={() => {
                  if (showLoadgenPrompt) setLoadgenPrompt(false)
                  setLoadOpen((v) => !v)
                }}
                className={`${hudChromeBtn}${showLoadgenPrompt ? ' c9-loadgen-prompt' : ''}`}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M2 13h12M5 13V8m3 5V4m3 9V7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Load
                {showLoadgenPrompt ? (
                  <span className="rounded bg-[var(--c9-accent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    Start
                  </span>
                ) : null}
              </button>
            ) : null}

            <button
              type="button"
              aria-expanded={metricsDrawerOpen}
              aria-label="Detailed metrics"
              onClick={() => setMetricsDrawerOpen(!metricsDrawerOpen)}
              className={hudChromeBtn}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2 12h12M2 8h8M2 4h5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Metrics
            </button>

            {kpiRows.length > 0 ? (
              <button
                type="button"
                aria-label={chipsOpen ? 'Hide journey metrics' : 'Show journey metrics'}
                aria-expanded={chipsOpen}
                onClick={toggleChips}
                className="rounded p-1 text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)] active:scale-[0.96]"
              >
                <ChevronIcon open={chipsOpen} />
              </button>
            ) : null}

            {loadRunning && showLoad ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onStopLoad()}
                className="rounded-md bg-red-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-red-500 active:scale-[0.98] disabled:opacity-60"
              >
                Stop
              </button>
            ) : null}
          </div>
        </div>


        {chipsOpen && kpiRows.length > 0 ? (
          <div className="flex min-h-8 items-center gap-x-4 gap-y-1 overflow-x-auto border-b border-[var(--c9-border)] bg-[var(--c9-bg-surface)] px-3 py-1.5">
            {kpiRows.map((row) => {
              const alert = kpiChipIsAlert(row)
              return (
                <span
                  key={row.id}
                  title={row.label}
                  className="inline-flex shrink-0 items-baseline gap-1.5 text-[12px]"
                >
                  <span className="text-[var(--c9-muted)]">{row.label}</span>
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
            <div ref={loadPanelRef}>
              <div
                role="dialog"
                aria-label="Load control"
                className="c9-load-panel"
                style={{
                  top: loadPos.top,
                  right: loadPos.right,
                  maxHeight: loadPos.maxHeight,
                }}
              >
                <p className="c9-load-panel-status" aria-live="polite">
                  {loadRunning
                    ? `Running ${fmtRate(runningRps)} rps${
                        loadPhaseLabel ? ` · ${loadPhaseLabel}` : ''
                      }${
                        runningTotal > 0 ? ` · ${fmtInt(runningTotal)} total` : ''
                      }`
                    : '\u00a0'}
                </p>
                <div className="c9-load-panel-body">
                <div className="c9-load-panel-field">
                  <label htmlFor="live-load-rps">Base RPS</label>
                  <input
                    id="live-load-rps"
                    type="number"
                    min={1}
                    max={500}
                    autoFocus
                    value={rps}
                    title={INGRESS_HELP_LIVE}
                    onChange={(e) => {
                      setRps(
                        Math.min(500, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={500}
                    step={1}
                    value={rps}
                    aria-label="Base RPS slider"
                    className="c9-load-panel-range"
                    onChange={(e) => {
                      setRps(Number(e.target.value))
                    }}
                  />
                </div>
                {hasMixControls ? (
                  <>
                    <p className="c9-load-panel-hint font-medium text-[var(--c9-text)]">
                      Traffic mix
                    </p>
                    {loadEndpoints.map((endpoint, index) => (
                      <EndpointMixSlider
                        key={distributionKey(endpoint.method, endpoint.pathTemplate)}
                        endpoint={endpoint}
                        index={index}
                        value={mixPercents[index] ?? 0}
                        label={endpointMixLabel(
                          `${endpoint.method} ${endpoint.pathTemplate}`,
                          allJourneys,
                        )}
                        onChange={(next) => {
                          setMixPercents((prev) =>
                            redistributePercents(prev, index, next),
                          )
                        }}
                      />
                    ))}
                  </>
                ) : null}
                {hasSchedulePicker ? (
                  <div className="c9-load-panel-field">
                    <label htmlFor="live-load-schedule">Schedule</label>
                    <select
                      id="live-load-schedule"
                      value={scheduleId}
                      disabled={loadRunning}
                      onChange={(e) => setScheduleId(e.target.value)}
                    >
                      {(resolvedLoadgenConfig?.schedules ?? []).map((sched) => (
                        <option key={sched.id} value={sched.id}>
                          {sched.label}
                        </option>
                      ))}
                    </select>
                    {schedulePhaseSummary ? (
                      <p className="c9-load-panel-hint">{schedulePhaseSummary}</p>
                    ) : null}
                  </div>
                ) : null}
                {visibleActorParams.map((param) => {
                  const bounds = actorParamBounds(param)
                  const value = actorParams[param.key] ?? param.default
                  return (
                    <div key={param.key} className="c9-load-panel-field">
                      <label htmlFor={`live-load-${param.key}`}>
                        {formatActorParamLabel(param.key)}
                        <span className="c9-load-panel-value">{value}</span>
                      </label>
                      <input
                        id={`live-load-${param.key}`}
                        type="range"
                        min={bounds.min}
                        max={bounds.max}
                        step={bounds.step}
                        value={value}
                        disabled={loadRunning}
                        className="c9-load-panel-range"
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          setActorParams((prev) => ({ ...prev, [param.key]: next }))
                        }}
                      />
                    </div>
                  )
                })}
                </div>
                <div className="c9-load-panel-footer">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (loadRunning) void onStopLoad()
                    else void onStartLoad()
                  }}
                  className={`c9-load-panel-cta w-full rounded-md px-3 py-2 text-[13px] font-medium text-white active:scale-[0.98] ${
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
                </div>
              </div>
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
        template={snapshotTemplateId ?? 'unknown'}
        context="live"
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

function actorParamBounds(param: LoadgenActorParamSpec): {
  min: number
  max: number
  step: number
} {
  if (param.type === 'percent') {
    return { min: param.min ?? 0, max: param.max ?? 100, step: 1 }
  }
  const min = param.min ?? 0
  const max = param.max ?? 100
  const step = max - min <= 10 ? 0.1 : 1
  return { min, max, step }
}

function EndpointMixSlider({
  endpoint,
  index,
  value,
  label,
  onChange,
}: {
  endpoint: LoadgenEndpointSpec
  index: number
  value: number
  label: string
  onChange: (next: number) => void
}) {
  const id = `live-load-mix-${index}-${endpoint.pathTemplate.replace(/[^\w]+/g, '-')}`
  return (
    <div className="c9-load-panel-field">
      <label htmlFor={id}>
        {label}
        <span className="c9-load-panel-value">{value}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label={`${label} traffic share`}
        className="c9-load-panel-range"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function MixBar({
  segments,
  onClick,
}: {
  segments: LoadMixSegment[]
  onClick?: () => void
}) {
  const inner = segments.map((seg) => {
    const flexShare = seg.share != null ? seg.share * 100 : seg.pct
    return (
    <span
      key={seg.id}
      className="flex min-w-[4px] items-center justify-center overflow-hidden px-1.5 text-[10px] font-medium leading-none text-white/90"
      style={{
        flexGrow: Math.max(flexShare, 2),
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
    )
  })
  const className =
    'flex h-5 min-w-[10rem] max-w-[22rem] flex-1 overflow-hidden rounded-[4px]'
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
