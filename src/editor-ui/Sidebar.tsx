import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  type DeploymentResult,
  createDeployment,
  deleteDeployment,
  getDeployment,
  getTemplates,
  type TemplateInfo,
} from '../lib/api'
import { ensureResourceProfilesLoaded } from '../lib/resourceProfileStore'
import { ensureTopologyRulesLoaded } from '../lib/topologyRulesStore'
import {
  debugAuthError,
  mapAuthErrorMessage,
} from '../lib/authErrorMessage'
import {
  mapDeployRequestError,
  type DeployRequestMessage,
} from '../lib/deployRequestMessage'
import { switchTemplatePresetMode } from '../lib/switchTemplatePresetMode'
import { SHOW_SIMULATION_UI } from '../lib/featureFlags'
import {
  TEMPLATE_LIVE_NOT_OFFERED_HINT,
  templateOffersLiveDeploy,
} from '../lib/templateAvailability'
import { FALLBACK_TEMPLATE_CATALOG } from '../lib/templateCatalogFallback'
import {
  startEngineerCheckout,
  UPGRADE_TO_ENGINEER_LABEL,
} from '../lib/stripeCheckout'
import {
  EMAIL_UNCONFIRMED,
  MONTHLY_SESSION_LIMIT,
  ROOM_QUEUE_TITLE,
  formatRoomWaitingDetail,
  isAtMonthlySessionCap,
} from '../lib/deployQueue'
import { ApiError } from '../lib/apiError'
import { ResourceBudgetApiError } from '../lib/resourceBudgetError'
import {
  explorerComponentLocksActive,
} from '../lib/canvasContextMenuCatalog'
import {
  SWITCH_TO_FREE_TIER_DESIGN_LABEL,
} from '../lib/billingCopy'
import { snapshotToDeploymentDesign } from '../lib/deployPayload'
import { REQUEST_DEPLOY_EVENT } from '../lib/deployEvents'
import {
  canPickSessionLength,
  clampSessionMinutes,
  readSessionMinutesPref,
  resolveDeploySessionMinutes,
  sessionLengthLimits,
  writeSessionMinutesPref,
} from '../lib/sessionMinutes'
import {
  canvasQuotaForDisplay,
  designExceedsResourceQuota,
  displayQuotaTierLabel,
  toResourceBudgetErrorResponse,
  type ResourceBudgetErrorResponse,
} from '../lib/sumDesignBudget'
import {
  clearLiveSessionPersist,
  persistLiveSession,
} from '../lib/liveSessionStorage'
import { discardWsEventsStorage } from '../lib/wsEventsPersist'
import { captureSessionSummaryWithApi } from '../lib/sessionCapture'
import { applyAutoArrange } from '../lib/applyAutoArrange'
import {
  CLIENT_LOADGEN_ID,
} from '../lib/spawnClientNode'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useAuthStore } from '../product/stores/authStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'
import { findTopologyViolations } from '../lib/topologyGuard'
import {
  analyzeDeployTopology,
  type TopologyWarning,
} from '../lib/connectionSemantics'
import { assessGraphConstraints } from '../lib/graphConstraints'
import { WorkQueueLayoutSection } from './engines/WorkQueueLayoutSection'
import {
  quotaTierFromAuth,
  topologyLimitsForTier,
  topologyLimitsFromApi,
} from '../lib/userTier'
import {
  DeployModal,
  type DeployModalMode,
  type DeployStep,
} from './DeployModal'
import {
  TemplateModal,
  templateTitleForId,
  type TemplateSelectAction,
} from './TemplateModal'
import { TemplateLabSection } from './TemplateLabSection'
import { TemplateLabMiniRail } from './TemplateLabMiniRail'
import { recordCanvasHistory } from '../lib/canvasHistory'
import {
  trackEvent,
  deploymentAnalyticsProperties,
  categorizeSafeError,
  analyticsPresetModeFromStore,
  trackSessionEndedOnce,
  sessionEndedProperties,
  getDesignOptionSession,
  resetDesignOptionSession,
  type DeployBlockedReason,
} from '../lib/analytics'
import { loginPathWithReturnTo } from '../lib/authReturn'
import { supabase } from '../lib/supabase'
import {
  deployAdmitStatusFromCreate,
  deployRejectReasonFromError,
} from '../lib/deployWaitAnalytics'

const SIDEBAR_COLLAPSED_KEY = 'runcloud9.sidebarCollapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const loadedVariationId = useCanvasStore((s) => s.loadedVariationId)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const movementLocked = useCanvasStore((s) => s.movementLocked)
  const setMovementLocked = useCanvasStore((s) => s.setMovementLocked)
  const topologyBanner = useCanvasStore((s) => s.topologyBanner)
  const setTopologyBanner = useCanvasStore((s) => s.setTopologyBanner)
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const isPremiumUser = useAuthStore((s) => s.isPremium)
  const pendingDeployAfterAuth = useAuthStore((s) => s.pendingDeployAfterAuth)
  const setPendingDeployAfterAuth = useAuthStore((s) => s.setPendingDeployAfterAuth)

  const jobBindings = useCanvasStore((s) => s.jobBindings)

  const graphHonestyIssue = useMemo(() => {
    if (mode === 'live') return null
    return assessGraphConstraints(
      nodes,
      edges,
      jobBindings,
      snapshotTemplateId,
    )
  }, [mode, nodes, edges, jobBindings, snapshotTemplateId])

  const [deploying, setDeploying] = useState(false)
  const [tearing, setTearing] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const pickerSelectedRef = useRef(false)
  const [deploySteps, setDeploySteps] = useState<DeployStep[]>([])
  const [deployModalOpen, setDeployModalOpen] = useState(false)
  const [deployModalMode, setDeployModalMode] =
    useState<DeployModalMode>('progress')
  const [deployRequestMessage, setDeployRequestMessage] =
    useState<DeployRequestMessage | null>(null)
  const [deploySimulationMessage, setDeploySimulationMessage] = useState<
    string | null
  >(null)
  const [deployResourceBudget, setDeployResourceBudget] =
    useState<ResourceBudgetErrorResponse | null>(null)
  const [deployInvalidEdges, setDeployInvalidEdges] = useState<
    Array<{ edgeId: string; message: string }>
  >([])
  const [deployDecorativeMessage, setDeployDecorativeMessage] = useState<
    string | null
  >(null)
  const [deployWarnings, setDeployWarnings] = useState<TopologyWarning[]>([])
  const sessionLimits = currentUser?.limits
  const { defaultMins: sessionDefaultMins, capMins: sessionCapMins } = useMemo(
    () => sessionLengthLimits(sessionLimits),
    [sessionLimits],
  )
  const sessionLengthConfigurable = canPickSessionLength(sessionLimits)
  const [sessionMinutesChoice, setSessionMinutesChoice] = useState(sessionDefaultMins)
  const pendingDeployResultRef = useRef<DeploymentResult | null>(null)
  const deployLockRef = useRef(false)
  const releaseDeployLock = useCallback(() => {
    deployLockRef.current = false
    setDeploying(false)
  }, [])
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)
  const [templateInfoById, setTemplateInfoById] = useState<
    Record<string, TemplateInfo>
  >({})

  /** runcloud9-ui: sidebar collapse is user-driven only (not tied to inspector dock). */
  const rail = collapsed

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    const dock = document.querySelector('.cv-dock')
    if (dock) {
      dock.setAttribute('data-collapsed', rail ? 'true' : 'false')
    }
  }, [rail])

  useEffect(() => {
    let cancelled = false
    void ensureResourceProfilesLoaded()
    void ensureTopologyRulesLoaded()
    if (import.meta.env.DEV) {
      const byId: Record<string, TemplateInfo> = {}
      for (const t of FALLBACK_TEMPLATE_CATALOG) byId[t.id] = t
      setTemplateInfoById((prev) => ({ ...byId, ...prev }))
      useTemplateRegistryStore.getState().mergeTemplates(FALLBACK_TEMPLATE_CATALOG)
    }
    getTemplates()
      .then((rows) => {
        if (cancelled) return
        const byId: Record<string, TemplateInfo> = {}
        for (const t of rows) byId[t.id] = t
        setTemplateInfoById(byId)
        useTemplateRegistryStore.getState().mergeTemplates(rows)
      })
      .catch(() => {
        /* deploy flow still backend-validated; ignore metadata fetch failures */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const proceedWithDeployResult = useCallback((result: DeploymentResult) => {
    const st = useCanvasStore.getState()
    const id = result.deploymentId
    const queued = result.status === 'queued'
    const roomDetail = queued
      ? formatRoomWaitingDetail({
          estimatedWaitSeconds: result.estimatedWaitSeconds,
        })
      : null
    setDeploySteps((s) =>
      s.map((step) =>
        step.id === 'provision'
          ? {
              ...step,
              state: 'active' as const,
              detail: queued
                ? `${ROOM_QUEUE_TITLE}. ${roomDetail}`
                : 'Provisioning in progress... open canvas to watch status',
            }
          : step.id === 'ready'
            ? {
                ...step,
                state: 'pending' as const,
                detail: queued
                  ? 'Will start when enough room frees up'
                  : 'Waiting for infrastructure to become running',
              }
            : step,
      ),
    )
    st.setDeploymentId(id)
    Object.keys(st.nodes).forEach((nid) => {
      st.updateNodeStatus(nid, 'provisioning')
    })
    st.setAllEdgesAnimated(false)
    st.setMode('design')
    st.setLiveSessionEndsAt(null)
    st.setLiveSessionStartedAt(null)
    st.selectNode(null)
    st.setPendingSource(null)
    st.setPlacingNodeType(null)
    st.setDesignTool('select')
    setBanner(
      queued
        ? `${ROOM_QUEUE_TITLE}. ${roomDetail}`
        : 'Deployment submitted. Provisioning started...',
    )
    persistLiveSession(id, useCanvasStore.getState().exportJSON())
    setDeployModalOpen(false)
    setDeployModalMode('progress')
    setDeployRequestMessage(null)
    setDeployResourceBudget(null)
    releaseDeployLock()
  }, [releaseDeployLock])

  useEffect(() => {
    const pref = readSessionMinutesPref()
    setSessionMinutesChoice(
      clampSessionMinutes(pref ?? sessionDefaultMins, sessionLimits),
    )
  }, [sessionDefaultMins, sessionCapMins, sessionLimits])

  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(t)
  }, [banner])

  useEffect(() => {
    if (!topologyBanner) return
    const t = window.setTimeout(() => setTopologyBanner(null), 8000)
    return () => window.clearTimeout(t)
  }, [topologyBanner, setTopologyBanner])

  const nodeCount = Object.keys(nodes).length
  const live = mode === 'live'
  const simulate = mode === 'simulate'
  const quotaTier = quotaTierFromAuth(
    currentUser,
    userRecord,
    Boolean(session),
  )
  const topologyLimits = currentUser
    ? topologyLimitsFromApi(currentUser.limits)
    : topologyLimitsForTier(session ? 'internal' : 'free')

  const quotaPreview = useMemo(() => {
    if (live || simulate || !snapshotTemplateId || nodeCount === 0 || !quotaTier)
      return null
    try {
      const design = snapshotToDeploymentDesign(
        useCanvasStore.getState().exportJSON(),
        { mutateCanvas: false },
      )
      const over = designExceedsResourceQuota(design, quotaTier)
      return over ? toResourceBudgetErrorResponse(over) : null
    } catch (e) {
      console.error('quota preview failed', e)
      return null
    }
  }, [live, simulate, snapshotTemplateId, nodeCount, nodes, edges, quotaTier])

  const quotaPreviewFailed = useMemo(() => {
    if (live || simulate || !snapshotTemplateId || nodeCount === 0) return false
    try {
      snapshotToDeploymentDesign(useCanvasStore.getState().exportJSON(), {
        mutateCanvas: false,
      })
      return false
    } catch {
      return true
    }
  }, [live, simulate, snapshotTemplateId, nodeCount, nodes, edges])

  const quotaDisplay = useMemo(
    () =>
      quotaPreview ? canvasQuotaForDisplay(quotaPreview, quotaTier) : null,
    [quotaPreview, quotaTier],
  )

  const topologyViolations = useMemo(() => {
    if (live || simulate || isPremiumUser || (session && !currentUser)) return []
    // DEV: allow placing Engineer-only nodes without the free-tier banner.
    if (!explorerComponentLocksActive()) return []
    return findTopologyViolations(nodes, topologyLimits)
  }, [
    live,
    simulate,
    isPremiumUser,
    session,
    currentUser,
    nodes,
    topologyLimits,
  ])
  const simRunning = useSimulationStore((s) => s.running)
  const selectedTemplate = snapshotTemplateId
    ? templateInfoById[snapshotTemplateId]
    : undefined
  const simulatorDisabledReason = !snapshotTemplateId
    ? 'Choose a template from the Templates section first'
    : !selectedTemplate
      ? 'Loading template capabilities...'
      : !selectedTemplate.simulatable
      ? `The "${selectedTemplate.name}" template is not simulatable right now.`
      : undefined
  const deployDisabledReason = !snapshotTemplateId
    ? 'Choose a template from the Templates section first'
    : !selectedTemplate
      ? 'Loading template capabilities...'
      : !selectedTemplate.available
      ? `The "${selectedTemplate.name}" template is not available to deploy yet.`
      : !selectedTemplate.deployable
      ? `The "${selectedTemplate.name}" template is simulation-only right now.`
      : !session
        ? 'Sign in to deploy infrastructure.'
        : topologyViolations.length > 0
          ? topologyViolations[0].message
        : quotaDisplay
          ? `Needs ${quotaDisplay.requested.cpu} CPU / ${quotaDisplay.requested.memory} RAM (${displayQuotaTierLabel(quotaTier)} canvas cap ${quotaDisplay.cap.cpu} / ${quotaDisplay.cap.memory})`
          : quotaPreviewFailed
            ? 'Could not validate resource quota for this design.'
            : undefined

  const handleAutoArrange = () => {
    if (!applyAutoArrange()) return
    setBanner('Auto-arranged by dependency depth.')
  }

  const handleTemplateAction = (action: TemplateSelectAction): boolean | void => {
    const st = useCanvasStore.getState()
    const hadDesign = Object.keys(st.nodes).length > 0
    if (hadDesign) {
      if (!window.confirm('Replace current design?')) return false
      recordCanvasHistory(st.nodes, st.edges, {
        snapshotTemplateId: st.snapshotTemplateId,
        loadedVariationId: st.loadedVariationId,
        jobBindings: { ...st.jobBindings },
      })
    }
    useSimulationStore.getState().stop()
    if (action.kind === 'preset') {
      st.loadTemplateSnapshot(action.preset(), 'design', {
        preserveUndoHistory: hadDesign,
      })
      st.setLoadedVariationId(action.variationId)
      st.setTemplatePresetMode(null)
      setBanner(`Loaded ${templateTitleForId(action.id) ?? action.id} template`)
      trackEvent('template_selected', {
        template: action.id,
        archetype: 'preset',
        variationId: action.variationId,
      })
      resetDesignOptionSession()
      return
    }
    st.startFromTemplate(action.id)
    st.setLoadedVariationId(null)
    st.setTemplatePresetMode(null)
    setBanner(
      `Selected ${templateTitleForId(action.id) ?? action.id} template (blank canvas)`,
    )
    trackEvent('template_selected', { template: action.id, archetype: 'scratch' })
    resetDesignOptionSession()
  }

  const trackDeployBlocked = useCallback(
    (reason: DeployBlockedReason, templateId = snapshotTemplateId) => {
      trackEvent('deploy_blocked', {
        template: templateId ?? 'none',
        reason,
      })
    },
    [snapshotTemplateId],
  )

  const resolveDeployBlockedReason = useCallback((): DeployBlockedReason | null => {
    if (nodeCount === 0) return 'empty_canvas'
    if (!snapshotTemplateId) return 'no_template'
    if (!selectedTemplate) return 'template_loading'
    if (!templateOffersLiveDeploy(selectedTemplate)) {
      return selectedTemplate.available
        ? 'template_not_deployable'
        : 'template_not_available'
    }
    if (quotaPreview) return 'resource_quota_exceeded'
    if (quotaPreviewFailed) return 'resource_quota_exceeded'
    if (topologyViolations.length > 0) return 'topology_violation'
    return null
  }, [
    nodeCount,
    quotaPreview,
    quotaPreviewFailed,
    selectedTemplate,
    snapshotTemplateId,
    topologyViolations.length,
  ])

  const showResourceQuotaRejected = useCallback(() => {
    if (!quotaPreview) return
    const friendly = mapDeployRequestError(
      new ResourceBudgetApiError(quotaPreview),
      { isFreeUser: !isPremiumUser, quotaTier },
    )
    releaseDeployLock()
    setDeployModalOpen(true)
    setDeployModalMode('request_rejected')
    setDeployRequestMessage(friendly)
    setDeployResourceBudget(friendly.resourceBudget ?? null)
    setDeploySimulationMessage(null)
    setDeploySteps((steps) =>
      steps.map((step) =>
        step.state === 'active'
          ? { ...step, state: 'error' as const, detail: 'Failed' }
          : step,
      ),
    )
  }, [isPremiumUser, quotaPreview, quotaTier, releaseDeployLock])

  const trackDeployModalDismissed = useCallback(
    (
      mode: 'request_rejected' | 'simulation_recommended',
      action: 'close' | 'dismiss' | 'simulate' | 'modify',
    ) => {
      trackEvent('deploy_modal_dismissed', {
        template: snapshotTemplateId ?? 'none',
        mode,
        action,
      })
    },
    [snapshotTemplateId],
  )

  const finishDeployCreate = useCallback(
    (result: DeploymentResult) => {
      const warnings = result.assessment?.warnings
      if (warnings && warnings.length > 0) {
        pendingDeployResultRef.current = result
        setDeployWarnings(warnings)
        setDeployModalMode('deploy_warnings')
        setDeployModalOpen(true)
        releaseDeployLock()
        return
      }
      proceedWithDeployResult(result)
    },
    [proceedWithDeployResult, releaseDeployLock],
  )

  const executeDeploy = useCallback(async () => {
    if (deployLockRef.current) return
    deployLockRef.current = true
    setDeploying(true)

    if (quotaPreview) {
      trackDeployBlocked(
        'resource_quota_exceeded',
        useCanvasStore.getState().snapshotTemplateId ?? undefined,
      )
      showResourceQuotaRejected()
      return
    }
    setBanner(null)
    setDeployModalOpen(true)
    setDeployModalMode('progress')
    setDeployRequestMessage(null)
    setDeploySimulationMessage(null)
    setDeployResourceBudget(null)
    setDeployInvalidEdges([])
    setDeployDecorativeMessage(null)
    setDeployWarnings([])
    setDeploySteps([
      {
        id: 'validate',
        label: 'Submitting deployment request',
        state: 'active',
        detail: 'Sending your design to RunCloud9 API...',
      },
      {
        id: 'provision',
        label: 'Provisioning infrastructure',
        state: 'pending',
      },
      { id: 'ready', label: 'Starting live session', state: 'pending' },
    ])

    setDeploySteps((s) =>
      s.map((step) =>
        step.id === 'validate'
          ? { ...step, state: 'done' as const }
          : step.id === 'provision'
            ? {
                ...step,
                state: 'active' as const,
                detail: 'Creating namespace and pods...',
              }
            : step,
      ),
    )

    try {
      const me = useAuthStore.getState().currentUser
      const st = useCanvasStore.getState()
      st.setSessionSummary(null)
      const wireMinutes = resolveDeploySessionMinutes(
        sessionMinutesChoice,
        me?.limits,
      )
      const design = snapshotToDeploymentDesign(st.exportJSON(), {
        ...(wireMinutes != null ? { sessionMinutes: wireMinutes } : {}),
      })
      let result: DeploymentResult
      try {
        result = await createDeployment(design)
      } catch (deployError) {
        if (
          deployError instanceof ApiError &&
          deployError.reason === EMAIL_UNCONFIRMED
        ) {
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) throw deployError
          result = await createDeployment(design)
        } else {
          throw deployError
        }
      }

      if (result.status === 'simulation_recommended') {
        trackEvent('deploy_assessment_shown', {
          template: design.template,
          assessmentVerdict: 'simulation_recommended',
        })
        setDeployModalMode('simulation_recommended')
        setDeploySimulationMessage(
          result.assessment?.explanation ??
            'This topology is not fully deployable yet.',
        )
        setDeploySteps((s) =>
          s.map((step) =>
            step.id === 'validate'
              ? { ...step, state: 'done' as const }
              : step.id === 'provision'
                ? {
                    ...step,
                    state: 'pending' as const,
                    detail: 'Skipped. Use simulation or adjust the design',
                  }
                : step,
          ),
        )
        releaseDeployLock()
        return
      }

      finishDeployCreate(result)
      const knobSession = getDesignOptionSession()
      const presetMode = analyticsPresetModeFromStore(
        useCanvasStore.getState().templatePresetMode,
      )
      const variationId = useCanvasStore.getState().loadedVariationId
      const admitStatus = deployAdmitStatusFromCreate(result.status)
      trackEvent('deployment_requested', {
        ...deploymentAnalyticsProperties(design),
        admitStatus,
        deploymentId: result.deploymentId,
        knobsChanged: knobSession.knobCount > 0,
        knobCount: knobSession.knobCount,
        ...(presetMode ? { presetMode } : {}),
        ...(variationId ? { variationId } : {}),
      })
      trackEvent('deployment_running', {
        template: design.template,
        deploymentId: result.deploymentId,
        elapsedSeconds: 0,
        admitStatus,
      })
    } catch (e) {
      const friendly = mapDeployRequestError(e, {
        isFreeUser: !isPremiumUser,
        quotaTier,
      })
      const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
      const rejectReason = deployRejectReasonFromError(e)
      trackEvent('deployment_failed', {
        template,
        phase: 'request',
        errorCategory: categorizeSafeError(e),
        ...(rejectReason ? { rejectReason } : {}),
      })
      if (friendly.actionLabel === 'Sign in') {
        setPendingDeployAfterAuth(true)
        setDeployModalMode('auth_required')
        setDeployRequestMessage(null)
      } else {
        setDeployModalMode('request_rejected')
        setDeployRequestMessage(friendly)
        setDeployResourceBudget(friendly.resourceBudget ?? null)
      }
      setDeploySimulationMessage(null)
      setDeploySteps((s) =>
        s.map((step) =>
          step.state === 'active'
            ? { ...step, state: 'error' as const, detail: 'Failed' }
            : step,
        ),
      )
      releaseDeployLock()
    }
  }, [
    finishDeployCreate,
    isPremiumUser,
    quotaPreview,
    quotaTier,
    releaseDeployLock,
    sessionMinutesChoice,
    setPendingDeployAfterAuth,
    showResourceQuotaRejected,
    trackDeployBlocked,
  ])

  const runDeploy = useCallback(async () => {
    if (live || deploying) return
    if (nodeCount === 0) {
      trackDeployBlocked('empty_canvas')
      setBanner('Add at least one node before deploying.')
      return
    }

    const stCheck = useCanvasStore.getState()
    if (!stCheck.snapshotTemplateId) {
      trackDeployBlocked('no_template')
      setBanner('Select a template before deploying.')
      return
    }
    if (selectedTemplate && !templateOffersLiveDeploy(selectedTemplate)) {
      trackDeployBlocked(
        selectedTemplate.available
          ? 'template_not_deployable'
          : 'template_not_available',
        stCheck.snapshotTemplateId,
      )
      setBanner(
        selectedTemplate.available
          ? `The "${selectedTemplate.name}" template is simulation-only right now.`
          : `The "${selectedTemplate.name}" template is not available to deploy yet.`,
      )
      return
    }

    const activeSession = useAuthStore.getState().session
    if (!activeSession) {
      trackDeployBlocked('auth_required', stCheck.snapshotTemplateId)
      releaseDeployLock()
      setPendingDeployAfterAuth(true)
      setDeployModalOpen(true)
      setDeployModalMode('auth_required')
      setDeploySimulationMessage(null)
      setDeployRequestMessage(null)
      return
    }

    const me = useAuthStore.getState().currentUser
    if (isAtMonthlySessionCap(me)) {
      trackDeployBlocked('monthly_session_limit', stCheck.snapshotTemplateId)
      const friendly = mapDeployRequestError(
        new ApiError(
          429,
          'monthly session limit reached. Upgrade or wait until next month',
          MONTHLY_SESSION_LIMIT,
        ),
        { isFreeUser: me?.effectiveTier === 'free' },
      )
      releaseDeployLock()
      setDeployModalOpen(true)
      setDeployModalMode('request_rejected')
      setDeployRequestMessage(friendly)
      setDeploySimulationMessage(null)
      setDeployResourceBudget(null)
      return
    }

    const supportsWorker = selectedTemplate?.supportsWorker !== false
    const preflight = analyzeDeployTopology(
      stCheck.nodes,
      stCheck.edges,
      supportsWorker,
      stCheck.jobBindings,
      stCheck.snapshotTemplateId,
    )
    if (preflight.wholeDesignIssue) {
      setDeployInvalidEdges([
        { edgeId: 'design', message: preflight.wholeDesignIssue },
      ])
      setDeployModalOpen(true)
      setDeployModalMode('invalid_topology')
      return
    }
    if (preflight.invalidEdges.length > 0) {
      setDeployInvalidEdges(preflight.invalidEdges)
      setDeployModalOpen(true)
      setDeployModalMode('invalid_topology')
      return
    }
    if (preflight.needsDecorativeConfirm) {
      setDeployDecorativeMessage(preflight.decorativeConfirmMessage)
      setDeployModalOpen(true)
      setDeployModalMode('decorative_confirm')
      return
    }

    if (quotaPreview) {
      trackDeployBlocked('resource_quota_exceeded', stCheck.snapshotTemplateId)
      showResourceQuotaRejected()
      return
    }

    await executeDeploy()
  }, [
    deploying,
    live,
    nodeCount,
    quotaPreview,
    releaseDeployLock,
    selectedTemplate,
    executeDeploy,
    setPendingDeployAfterAuth,
    showResourceQuotaRejected,
    trackDeployBlocked,
  ])

  const handleDeploy = () => {
    void runDeploy()
  }

  useEffect(() => {
    if (!session || !pendingDeployAfterAuth) return
    setPendingDeployAfterAuth(false)
    void runDeploy()
  }, [session, pendingDeployAfterAuth, runDeploy, setPendingDeployAfterAuth])

  useEffect(() => {
    const onRequestDeploy = () => {
      void runDeploy()
    }
    window.addEventListener(REQUEST_DEPLOY_EVENT, onRequestDeploy)
    return () => window.removeEventListener(REQUEST_DEPLOY_EVENT, onRequestDeploy)
  }, [runDeploy])

  useEffect(() => {
    if (searchParams.get('redeploy') !== '1') return
    const next = new URLSearchParams(searchParams)
    next.delete('redeploy')
    setSearchParams(next, { replace: true })
    queueMicrotask(() => {
      void runDeploy()
    })
  }, [searchParams, setSearchParams, runDeploy])

  const dismissAuthModal = useCallback(() => {
    setPendingDeployAfterAuth(false)
    setDeployModalOpen(false)
    setDeployModalMode('progress')
    setDeployRequestMessage(null)
    setDeploySimulationMessage(null)
    setDeployResourceBudget(null)
    releaseDeployLock()
  }, [releaseDeployLock, setPendingDeployAfterAuth])

  const handleTeardown = async () => {
    if (!live || tearing || !deploymentId) return
    setTearing(true)
    setBanner(null)
    try {
      await deleteDeployment(deploymentId)
      const st = useCanvasStore.getState()
      trackSessionEndedOnce(
        deploymentId,
        sessionEndedProperties('user_teardown'),
      )
      if (st.nodes[CLIENT_LOADGEN_ID]) {
        st.removeNode(CLIENT_LOADGEN_ID)
      }
      let apiMetrics: Record<string, unknown> | undefined
      try {
        const dep = await getDeployment(deploymentId)
        apiMetrics = dep.metricsSummary
      } catch {
        apiMetrics = undefined
      }
      captureSessionSummaryWithApi(apiMetrics, deploymentId)
      st.setMode('design')
      st.setDeploymentId(null)
      st.setLiveSessionEndsAt(null)
    st.setLiveSessionStartedAt(null)
      st.setAllEdgesAnimated(false)
      discardWsEventsStorage(deploymentId)
      useMetricsStore.getState().clearMetrics()
      useLogStore.getState().clearLogs()
      Object.keys(st.nodes).forEach((nid) => {
        st.updateNodeStatus(nid, 'idle')
      })
      clearLiveSessionPersist()
      setBanner('Returned to design mode.')
    } catch (e) {
      debugAuthError(e, 'teardown')
      setBanner(
        mapAuthErrorMessage(e, 'Could not tear down deployment. Please try again.'),
      )
    } finally {
      setTearing(false)
    }
  }

  const deployBlockedReason = resolveDeployBlockedReason()
  const labPlaced = nodeCount > 0 && Boolean(snapshotTemplateId)

  const clearLab = () => {
    const st = useCanvasStore.getState()
    if (Object.keys(st.nodes).length > 0) {
      recordCanvasHistory(st.nodes, st.edges, {
        snapshotTemplateId: st.snapshotTemplateId,
        loadedVariationId: st.loadedVariationId,
        jobBindings: { ...st.jobBindings },
      })
      st.loadTemplateSnapshot(
        {
          version: '1.0',
          nodes: [],
          edges: [],
          exportedAt: new Date().toISOString(),
        },
        'design',
        { preserveUndoHistory: true },
      )
    } else {
      st.setSnapshotTemplateId(null)
    }
    st.setLoadedVariationId(null)
    resetDesignOptionSession()
    setBanner('Template cleared.')
  }

  const statusLine = tearing
    ? 'Tearing down…'
    : deploying
      ? 'Deploying…'
      : live
        ? 'Running'
        : simulate && simRunning
          ? 'Simulating'
          : null

  return (
    <aside
      className="cv-rail"
      data-collapsed={rail ? 'true' : 'false'}
      aria-label="Canvas sidebar"
    >
      <header className="cv-rail-hd">
        <div className="cv-rail-ttl">
          <Link to="/" className="hover:opacity-90" aria-label="RunCloud9 home">
            <b>Canvas</b>
          </Link>
          <span className="cv-sub">playground</span>
        </div>
        <button
          type="button"
          className="cv-collapse"
          aria-expanded={!rail}
          aria-controls="side-body"
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          disabled={false}
          onClick={() => setCollapsed((c) => !c)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m9 6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      <TemplateLabMiniRail
        disabled={live || simulate}
        loadedVariationId={loadedVariationId}
        snapshotTemplateId={snapshotTemplateId}
        onPlace={handleTemplateAction}
      />
      <div className="cv-rail-body" id="side-body">
        <section className="cv-sec" aria-labelledby="h-layout">
          <h2 className="cv-h" id="h-layout">
            Layout
          </h2>
          <TemplateLabSection
            disabled={live || simulate}
            loadedVariationId={loadedVariationId}
            snapshotTemplateId={snapshotTemplateId}
            onPlace={handleTemplateAction}
          />
          <p className="cv-undo" id="undo" role="status" aria-live="polite" />
        </section>
        <section className="cv-sec" aria-labelledby="h-canvas">
          <h2 className="cv-h" id="h-canvas">
            Canvas
          </h2>
          <div className="cv-col">
            <button
              type="button"
              className="cv-ghost-btn"
              aria-pressed={movementLocked}
              disabled={live || simulate || !labPlaced}
              onClick={() => setMovementLocked(!movementLocked)}
            >
              {movementLocked ? 'Unlock movement' : 'Lock movement'}
            </button>
            <button
              type="button"
              className="cv-ghost-btn"
              disabled={live || simulate || !labPlaced || nodeCount === 0}
              onClick={handleAutoArrange}
            >
              Auto arrange
            </button>
            <button
              type="button"
              className="cv-ghost-btn"
              disabled={live || simulate || !labPlaced}
              onClick={clearLab}
            >
              Clear
            </button>
          </div>
          <p className="cv-why" id="canvas-why" hidden={labPlaced}>
            Place a lab first
          </p>
          <p className="cv-note" id="canvas-note" role="status">
            {banner ?? topologyBanner ?? graphHonestyIssue ?? ''}
          </p>
        </section>
        {labPlaced ? (
          <section className="cv-sec">
            <WorkQueueLayoutSection />
          </section>
        ) : null}
      </div>
      <form
        className="cv-rail-ft"
        aria-label="Deploy"
        onSubmit={(e) => e.preventDefault()}
      >
        {statusLine ? (
          <p className="text-center text-xs text-[var(--c9-muted)]">{statusLine}</p>
        ) : null}
        {live ? (
          <button
            type="button"
            disabled={tearing}
            onClick={handleTeardown}
              className="cv-deploy-btn danger w-full disabled:opacity-50"
          >
            Teardown
          </button>
        ) : simulate && SHOW_SIMULATION_UI ? (
          <>
            <button
              type="button"
              onClick={() => {
                useSimulationStore.getState().stop()
                setBanner('Simulation stopped.')
              }}
              className="w-full rounded-none border border-amber-600/70 bg-amber-950/40 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-amber-100 transition-colors duration-200 hover:border-amber-500 hover:bg-amber-900/40"
            >
              Stop simulation
            </button>
            <button
              type="button"
              onClick={() => {
                useSimulationStore.getState().stop()
                const st = useCanvasStore.getState()
                if (st.nodes[CLIENT_LOADGEN_ID]) {
                  st.removeNode(CLIENT_LOADGEN_ID)
                }
                st.setMode('design')
                setBanner(null)
              }}
              className="w-full rounded-none border border-violet-600/60 bg-violet-950/40 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-violet-100 transition-colors duration-200 hover:border-violet-500 hover:bg-violet-900/40"
            >
              Exit simulation
            </button>
          </>
        ) : (
          <>
            {sessionLengthConfigurable ? (
              <>
                <div className="cv-len">
                  <label htmlFor="sess-len">Session length</label>
                  <span>
                    <input
                      id="sess-len"
                      type="number"
                      min={sessionDefaultMins}
                      max={sessionCapMins}
                      step={1}
                      value={sessionMinutesChoice}
                      disabled={deploying || !labPlaced}
                      onChange={(e) => {
                        const next = clampSessionMinutes(
                          Number(e.target.value),
                          sessionLimits,
                        )
                        setSessionMinutesChoice(next)
                        writeSessionMinutesPref(next)
                      }}
                    />
                    min
                  </span>
                </div>
                <p className="cv-hint">
                  Runs this long once the environment is ready.
                </p>
              </>
            ) : session ? (
              <p className="cv-hint">Session length: {sessionDefaultMins} min</p>
            ) : null}
            <button
              type="button"
              className="cv-deploy-btn"
              disabled={deploying || !!deployBlockedReason || !labPlaced}
              title={deployDisabledReason ?? (labPlaced ? 'Deploy this design' : 'Place a lab first')}
              onClick={handleDeploy}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="cv-deploy-ic">
                <path
                  d="m22 2-7 20-4-9-9-4 20-7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              {session ? (deploying ? 'Deploying…' : 'Deploy') : 'Sign in to deploy'}
            </button>
            <p className="cv-why" id="deploy-why" hidden={labPlaced}>
              Place a lab first
            </p>
            <p className="cv-note" id="deploy-note" role="status">
              {[
                topologyViolations[0]?.message,
                quotaDisplay
                  ? `This design needs ${quotaDisplay.requested.cpu} CPU / ${quotaDisplay.requested.memory} RAM (cap ${quotaDisplay.cap.cpu} / ${quotaDisplay.cap.memory}).`
                  : null,
                selectedTemplate && !templateOffersLiveDeploy(selectedTemplate)
                  ? TEMPLATE_LIVE_NOT_OFFERED_HINT
                  : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
            {SHOW_SIMULATION_UI && nodeCount > 0 && snapshotTemplateId ? (
              <button
                type="button"
                disabled={!selectedTemplate || !selectedTemplate.simulatable}
                title={simulatorDisabledReason}
                onClick={() => {
                  if (!selectedTemplate || !selectedTemplate.simulatable) return
                  useSimulationStore.getState().stop()
                  useCanvasStore.getState().setMode('simulate')
                  setBanner(
                    'Simulation view. Press Start simulation in the top bar when ready.',
                  )
                }}
                className="w-full rounded-none border border-violet-600/60 bg-violet-950/40 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-violet-100 transition-colors duration-200 hover:border-violet-500 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Simulator
              </button>
            ) : null}
          </>
        )}
      </form>

      <TemplateModal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false)
          trackEvent('template_picker_dismissed', {
            template: useCanvasStore.getState().snapshotTemplateId ?? 'none',
            hadSelection: pickerSelectedRef.current,
          })
        }}
        onSelect={(action) => {
          const result = handleTemplateAction(action)
          if (result !== false) pickerSelectedRef.current = true
          return result
        }}
      />

      <DeployModal
        open={deployModalOpen}
        steps={deploySteps}
        mode={deployModalMode}
        requestTitle={deployRequestMessage?.title}
        requestMessage={deployRequestMessage?.body}
        technicalDetails={deployRequestMessage?.technicalDetails}
        requestActionLabel={deployRequestMessage?.actionLabel}
        resourceBudget={deployResourceBudget}
        onRequestAction={
          deployRequestMessage?.actionLabel === 'Sign in'
            ? () => navigate(loginPathWithReturnTo('/canvas'))
            : deployRequestMessage?.actionLabel === UPGRADE_TO_ENGINEER_LABEL
              ? () => {
                  void startEngineerCheckout({ source: 'sidebar' }).catch(
                    (err: unknown) => {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : 'Could not start checkout.'
                      setBanner(msg)
                      setDeployRequestMessage((prev) =>
                        prev ? { ...prev, body: msg } : prev,
                      )
                    },
                  )
                }
              : deployRequestMessage?.actionLabel
                ? () => navigate(loginPathWithReturnTo('/canvas'))
                : undefined
        }
        requestSecondaryActionLabel={deployRequestMessage?.secondaryActionLabel}
        onRequestSecondaryAction={
          deployRequestMessage?.secondaryActionLabel ===
          SWITCH_TO_FREE_TIER_DESIGN_LABEL
            ? () => {
                const ok = switchTemplatePresetMode('explorer', {
                  user: useAuthStore.getState().userRecord,
                  confirmIfDirty: false,
                })
                if (ok) {
                  setDeployModalOpen(false)
                  setDeployModalMode('progress')
                  setDeployRequestMessage(null)
                  setBanner('Switched to Free tier design.')
                }
              }
            : undefined
        }
        onAuthDismiss={dismissAuthModal}
        simulationRecommended={deploySimulationMessage}
        invalidTopologyItems={deployInvalidEdges}
        decorativeConfirmMessage={deployDecorativeMessage}
        deployWarnings={deployWarnings}
        onDeployAnyway={() => {
          setDeployDecorativeMessage(null)
          void executeDeploy()
        }}
        onDeployWarningsContinue={() => {
          const pending = pendingDeployResultRef.current
          pendingDeployResultRef.current = null
          setDeployWarnings([])
          if (pending) proceedWithDeployResult(pending)
        }}
        onClose={() => {
          if (deployModalMode === 'request_rejected') {
            trackDeployModalDismissed('request_rejected', 'dismiss')
          } else if (deployModalMode === 'simulation_recommended') {
            trackDeployModalDismissed('simulation_recommended', 'close')
          }
          setDeployModalOpen(false)
          setDeployModalMode('progress')
          setDeployRequestMessage(null)
          setDeploySimulationMessage(null)
          setDeployResourceBudget(null)
          setDeployInvalidEdges([])
          setDeployDecorativeMessage(null)
          setDeployWarnings([])
          pendingDeployResultRef.current = null
          releaseDeployLock()
        }}
        onSimulateDesign={() => {
          trackDeployModalDismissed('simulation_recommended', 'simulate')
          useCanvasStore.getState().setMode('simulate')
          setBanner(
            'Simulation mode. Explore the design without cluster provisioning.',
          )
          setDeployModalOpen(false)
          setDeployModalMode('progress')
          setDeployRequestMessage(null)
          setDeploySimulationMessage(null)
          setDeployResourceBudget(null)
          releaseDeployLock()
        }}
        onModifyDesign={() => {
          trackDeployModalDismissed('simulation_recommended', 'modify')
          setDeployModalOpen(false)
          setDeployModalMode('progress')
          setDeployRequestMessage(null)
          setDeploySimulationMessage(null)
          setDeployResourceBudget(null)
          releaseDeployLock()
        }}
      />
    </aside>
  )
}
