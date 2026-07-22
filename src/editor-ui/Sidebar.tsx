import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  type DeploymentResult,
  createDeployment,
  deleteDeployment,
  getDeployment,
  getTemplates,
  type TemplateInfo,
} from '../lib/api'
import { ensureResourceProfilesLoaded } from '../lib/resourceProfileStore'
import {
  debugAuthError,
  mapAuthErrorMessage,
} from '../lib/authErrorMessage'
import {
  mapDeployRequestError,
  type DeployRequestMessage,
} from '../lib/deployRequestMessage'
import {
  startEngineerCheckout,
  UPGRADE_TO_ENGINEER_LABEL,
} from '../lib/stripeCheckout'
import {
  MONTHLY_SESSION_LIMIT,
  ROOM_QUEUE_TITLE,
  formatRoomWaitingDetail,
  isAtMonthlySessionCap,
} from '../lib/deployQueue'
import { ApiError } from '../lib/apiError'
import { snapshotToDeploymentDesign } from '../lib/deployPayload'
import {
  designExceedsResourceQuota,
  toResourceBudgetErrorResponse,
  type ResourceBudgetErrorResponse,
} from '../lib/sumDesignBudget'
import {
  clearLiveSessionPersist,
  persistLiveSession,
} from '../lib/liveSessionStorage'
import { discardWsEventsStorage } from '../lib/wsEventsPersist'
import { captureSessionSummaryWithApi } from '../lib/sessionCapture'
import {
  CLIENT_LOADGEN_ID,
} from '../lib/spawnClientNode'
import { autoArrangeByDependencyLayers } from '../lib/autoArrange'
import {
  recordCanvasHistory,
  withoutCanvasHistoryRecording,
} from '../lib/canvasHistory'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'
import { useCanvasStore, type CanvasNode } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useAuthStore } from '../product/stores/authStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'
import { findTopologyViolations } from '../lib/topologyGuard'
import {
  resolveEffectiveTier,
  resourceQuotaTier,
  topologyLimitsForTier,
  topologyLimitsFromApi,
} from '../lib/userTier'
import {
  DeployModal,
  type DeployModalMode,
  type DeployStep,
} from './DeployModal'
import { PredictionCards } from './PredictionCards'
import {
  TemplateModal,
  templateTitleForId,
  type TemplateSelectAction,
} from './TemplateModal'
import { trackEvent, deploymentAnalyticsProperties, categorizeSafeError } from '../lib/analytics'
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

const PALETTE: { type: CanvasNode['type']; title: string; face: string }[] = [
  { type: 'load_balancer', title: 'Load Balancer', face: 'var(--c9-info)' },
  { type: 'compute', title: 'App Server', face: 'var(--c9-text-muted)' },
  { type: 'database', title: 'Database', face: 'var(--c9-text-disabled)' },
  { type: 'cache', title: 'Cache', face: 'var(--c9-error)' },
  { type: 'message_queue', title: 'Message Queue', face: 'var(--c9-accent)' },
  { type: 'worker', title: 'Worker', face: 'var(--c9-accent-hover)' },
]

let emptyDragImage: HTMLCanvasElement | null = null

function getEmptyDragImage(): HTMLCanvasElement {
  if (!emptyDragImage) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    emptyDragImage = c
  }
  return emptyDragImage
}

export function Sidebar() {
  const navigate = useNavigate()
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const movementLocked = useCanvasStore((s) => s.movementLocked)
  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const setPlacingNodeType = useCanvasStore((s) => s.setPlacingNodeType)
  const setDesignTool = useCanvasStore((s) => s.setDesignTool)
  const setMovementLocked = useCanvasStore((s) => s.setMovementLocked)
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const isPremiumUser = useAuthStore((s) => s.isPremium)
  const pendingDeployAfterAuth = useAuthStore((s) => s.pendingDeployAfterAuth)
  const setPendingDeployAfterAuth = useAuthStore((s) => s.setPendingDeployAfterAuth)

  const [deploying, setDeploying] = useState(false)
  const [tearing, setTearing] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
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
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)
  const [templateInfoById, setTemplateInfoById] = useState<
    Record<string, TemplateInfo>
  >({})

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    let cancelled = false
    void ensureResourceProfilesLoaded()
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
                ? `${ROOM_QUEUE_TITLE} — ${roomDetail}`
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
    setDeploying(false)
  }, [])

  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(t)
  }, [banner])

  const nodeCount = Object.keys(nodes).length
  const live = mode === 'live'
  const simulate = mode === 'simulate'
  const effectiveTier =
    currentUser?.effectiveTier ?? resolveEffectiveTier(userRecord)
  const quotaTier = currentUser?.quotaTier ?? resourceQuotaTier(effectiveTier)
  const topologyLimits = currentUser
    ? topologyLimitsFromApi(currentUser.limits)
    : topologyLimitsForTier(effectiveTier)

  const quotaPreview = useMemo(() => {
    if (live || simulate || !snapshotTemplateId || nodeCount === 0) return null
    try {
      const design = snapshotToDeploymentDesign(useCanvasStore.getState().exportJSON())
      const over = designExceedsResourceQuota(design, quotaTier)
      return over ? toResourceBudgetErrorResponse(over) : null
    } catch {
      return null
    }
  }, [live, simulate, snapshotTemplateId, nodeCount, nodes, edges, quotaTier])

  const topologyViolations = useMemo(() => {
    if (live || simulate || isPremiumUser) return []
    return findTopologyViolations(nodes, topologyLimits)
  }, [live, simulate, isPremiumUser, nodes, topologyLimits])
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
      : !selectedTemplate.deployable
      ? `The "${selectedTemplate.name}" template is simulation-only right now.`
      : !session
        ? 'Sign in to deploy infrastructure.'
        : topologyViolations.length > 0
          ? topologyViolations[0].message
        : quotaPreview
          ? `Needs ${quotaPreview.requested.cpu} CPU / ${quotaPreview.requested.memory} RAM (plan cap ${quotaPreview.cap.cpu} / ${quotaPreview.cap.memory})`
          : undefined

  const togglePlace = (type: CanvasNode['type']) => {
    if (placingNodeType === type) {
      setPlacingNodeType(null)
    } else {
      setDesignTool('select')
      setPlacingNodeType(type)
    }
  }

  const handleTemplateAction = (action: TemplateSelectAction): boolean | void => {
    const st = useCanvasStore.getState()
    if (Object.keys(st.nodes).length > 0) {
      if (!window.confirm('Replace current design?')) return false
    }
    useSimulationStore.getState().stop()
    if (action.kind === 'preset') {
      st.loadTemplateSnapshot(action.preset(), 'design')
      setBanner(`Loaded ${templateTitleForId(action.id) ?? action.id} template`)
      trackEvent('template_selected', { template: action.id, archetype: 'preset' })
      return
    }
    st.startFromTemplate(action.id)
    setBanner(
      `Selected ${templateTitleForId(action.id) ?? action.id} template (blank canvas)`,
    )
    trackEvent('template_selected', { template: action.id, archetype: 'scratch' })
  }

  const handleAutoArrange = () => {
    const st = useCanvasStore.getState()
    const nodeList = Object.values(st.nodes)
    if (nodeList.length === 0) return
    const edgeList = Object.values(st.edges)
    const nextPositions = autoArrangeByDependencyLayers(nodeList, edgeList)
    recordCanvasHistory(st.nodes, st.edges)
    withoutCanvasHistoryRecording(() => {
      for (const [id, pos] of Object.entries(nextPositions)) {
        st.updateNodePosition(id, pos)
      }
    })
    requestCanvasFit()
    setBanner('Auto-arranged by dependency depth.')
  }

  const onDragStart =
    (type: CanvasNode['type']) => (e: DragEvent) => {
      e.dataTransfer.setData('application/runcloud9-node-type', type)
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0)
    }

  const runDeploy = useCallback(async () => {
    if (live || deploying) return
    if (nodeCount === 0) {
      setBanner('Add at least one node before deploying.')
      return
    }

    const stCheck = useCanvasStore.getState()
    if (!stCheck.snapshotTemplateId) {
      setBanner('Select a template before deploying.')
      return
    }

    const activeSession = useAuthStore.getState().session
    if (!activeSession) {
      setDeploying(false)
      setPendingDeployAfterAuth(true)
      setDeployModalOpen(true)
      setDeployModalMode('auth_required')
      setDeploySimulationMessage(null)
      setDeployRequestMessage(null)
      return
    }

    const me = useAuthStore.getState().currentUser
    if (isAtMonthlySessionCap(me)) {
      const friendly = mapDeployRequestError(
        new ApiError(
          429,
          'monthly session limit reached — upgrade or wait until next month',
          MONTHLY_SESSION_LIMIT,
        ),
        { isFreeUser: me?.effectiveTier === 'free' },
      )
      setDeploying(false)
      setDeployModalOpen(true)
      setDeployModalMode('request_rejected')
      setDeployRequestMessage(friendly)
      setDeploySimulationMessage(null)
      setDeployResourceBudget(null)
      return
    }

    setDeploying(true)
    setBanner(null)
    setDeployModalOpen(true)
    setDeployModalMode('progress')
    setDeployRequestMessage(null)
    setDeploySimulationMessage(null)
    setDeployResourceBudget(null)
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
      const st = useCanvasStore.getState()
      st.setSessionSummary(null)
      const design = snapshotToDeploymentDesign(st.exportJSON())
      const result = await createDeployment(design)

      if (result.status === 'simulation_recommended') {
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
                    detail: 'Skipped — use simulation or adjust the design',
                  }
                : step,
          ),
        )
        return
      }

      proceedWithDeployResult(result)
      trackEvent('deployment_requested', {
        ...deploymentAnalyticsProperties(design),
        admitStatus: deployAdmitStatusFromCreate(result.status),
      })
    } catch (e) {
      const friendly = mapDeployRequestError(e, {
        isFreeUser: !isPremiumUser,
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
      setDeploying(false)
    }
  }, [
    deploying,
    live,
    nodeCount,
    isPremiumUser,
    proceedWithDeployResult,
    setPendingDeployAfterAuth,
  ])

  const handleDeploy = () => {
    void runDeploy()
  }

  useEffect(() => {
    if (!session || !pendingDeployAfterAuth) return
    setPendingDeployAfterAuth(false)
    void runDeploy()
  }, [session, pendingDeployAfterAuth, runDeploy, setPendingDeployAfterAuth])

  const dismissAuthModal = useCallback(() => {
    setPendingDeployAfterAuth(false)
    setDeployModalOpen(false)
    setDeployModalMode('progress')
    setDeployRequestMessage(null)
    setDeploySimulationMessage(null)
    setDeployResourceBudget(null)
    setDeploying(false)
  }, [setPendingDeployAfterAuth])

  const handleTeardown = async () => {
    if (!live || tearing || !deploymentId) return
    setTearing(true)
    setBanner(null)
    try {
      await deleteDeployment(deploymentId)
      const st = useCanvasStore.getState()
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
      captureSessionSummaryWithApi(apiMetrics)
      st.setMode('design')
      st.setDeploymentId(null)
      st.setLiveSessionEndsAt(null)
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
      className={`relative flex h-full shrink-0 flex-col bg-[var(--c9-bg)] text-[var(--c9-text)] transition-[width] duration-200 ease-out ${
        collapsed ? 'w-12' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-[var(--c9-border)] bg-[var(--c9-surface)] p-2">
        {!collapsed ? (
          <Link
            to="/"
            className="min-w-0 truncate rounded px-2 text-left text-lg font-semibold tracking-tight text-[var(--c9-text)] transition-colors duration-200 hover:text-[var(--c9-accent)]"
            aria-label="Go to homepage"
          >
            RunCloud9
          </Link>
        ) : (
          <span className="sr-only">RunCloud9</span>
        )}
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded p-1.5 text-[var(--c9-muted)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] hover:text-[var(--c9-text)]"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      <div
        className={`flex-1 space-y-3 overflow-y-auto p-4 ${
          collapsed ? 'hidden' : ''
        }`}
      >
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--c9-muted)]">
          Templates
        </h2>
        <button
          type="button"
          disabled={live || simulate}
          onClick={() => setTemplateModalOpen(true)}
          className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-3 text-left text-sm font-medium text-[var(--c9-text)] transition-all duration-200 hover:border-[var(--c9-accent)] disabled:opacity-40"
        >
          <span className="text-xs uppercase tracking-wider text-[var(--c9-muted)]">
            Template
          </span>
          <div className="mt-1">
            {templateTitleForId(snapshotTemplateId) ?? 'Choose a template…'}
          </div>
        </button>
        <button
          type="button"
          disabled={live || simulate || !snapshotTemplateId}
          onClick={() => {
            useCanvasStore.getState().setSnapshotTemplateId(null)
            setBanner('Template cleared.')
          }}
          className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 px-4 py-2 text-left text-xs font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear template
        </button>
        <TemplateModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSelect={handleTemplateAction}
        />

        <h2 className="pt-2 text-xs font-medium uppercase tracking-wider text-[var(--c9-muted)]">
          Components
        </h2>
        <div className="space-y-2 rounded border border-[var(--c9-border)] bg-[var(--c9-surface)]/60 p-2">
          <button
            type="button"
            onClick={() => setMovementLocked(!movementLocked)}
            className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 px-3 py-2 text-left text-xs font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
          >
            {movementLocked ? 'Unlock movement' : 'Lock movement'}
          </button>
          <button
            type="button"
            disabled={nodeCount === 0}
            onClick={handleAutoArrange}
            className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 px-3 py-2 text-left text-xs font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Auto arrange
          </button>
        </div>
        <p className="text-xs leading-snug text-[var(--c9-muted)]">
          Drag onto the canvas, or click a component then click the grid. Esc cancels.
        </p>
        {placingNodeType ? (
          <p className="text-xs text-amber-200/90">
            Placing: click the grid. Press Esc to cancel.
          </p>
        ) : null}
        {banner ? (
          <p className="rounded border border-[var(--c9-border)] bg-[var(--c9-surface)] px-2 py-1.5 text-xs text-[var(--c9-text)]">
            {banner}
          </p>
        ) : null}
        <ul className="space-y-2">
          {PALETTE.map(({ type, title, face }) => {
            const placing = placingNodeType === type
            return (
              <li key={type}>
                <button
                  type="button"
                  draggable={!live}
                  disabled={live}
                  onDragStart={live ? undefined : onDragStart(type)}
                  onClick={() => !live && togglePlace(type)}
                  className={`flex w-full items-center gap-3 rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/70 px-3 py-2.5 text-left text-sm text-[var(--c9-text)] transition-all duration-200 hover:border-[var(--c9-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
                    placing ? 'ring-2 ring-[var(--c9-accent)] ring-offset-2 ring-offset-[var(--c9-bg)]' : ''
                  }`}
                  style={{ borderLeftWidth: 4, borderLeftColor: face }}
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded"
                    style={{ backgroundColor: face }}
                    aria-hidden
                  />
                  <span className="font-medium">{title}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {!live ? <PredictionCards /> : null}
      </div>
      <div
        className={`space-y-2 border-t border-[var(--c9-border)] bg-[var(--c9-surface)]/80 p-4 ${
          collapsed ? 'hidden' : ''
        }`}
      >
        {statusLine ? (
          <p className="text-center text-xs text-[var(--c9-muted)]">{statusLine}</p>
        ) : null}
        {live ? (
          <button
            type="button"
            disabled={tearing}
            onClick={handleTeardown}
              className="w-full rounded bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-600 disabled:opacity-50"
          >
            Teardown
          </button>
        ) : simulate ? (
          <>
            <button
              type="button"
              onClick={() => {
                useSimulationStore.getState().stop()
                setBanner('Simulation stopped.')
              }}
              className="w-full rounded border border-amber-600/70 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 transition-colors duration-200 hover:border-amber-500 hover:bg-amber-900/40"
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
              className="w-full rounded bg-violet-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-700"
            >
              Exit simulation
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={
                deploying ||
                nodeCount === 0 ||
                !snapshotTemplateId ||
                !selectedTemplate ||
                !selectedTemplate.deployable ||
                Boolean(quotaPreview) ||
                topologyViolations.length > 0
              }
              title={deployDisabledReason}
              onClick={() => handleDeploy()}
              className="w-full rounded bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] disabled:opacity-50"
            >
              {session ? 'Deploy' : 'Sign in to deploy'}
            </button>
            {topologyViolations.length > 0 ? (
              <p className="text-[11px] leading-snug text-amber-300/90">
                {topologyViolations[0].message}
              </p>
            ) : null}
            {quotaPreview ? (
              <p className="text-[11px] leading-snug text-amber-300/90">
                This design exceeds the {quotaPreview.tier} quota ({quotaPreview.requested.cpu} /{' '}
                {quotaPreview.requested.memory} vs cap {quotaPreview.cap.cpu} /{' '}
                {quotaPreview.cap.memory}). Downsize nodes or replicas to deploy.
              </p>
            ) : null}
            {nodeCount > 0 && snapshotTemplateId ? (
              <button
                type="button"
                disabled={!selectedTemplate || !selectedTemplate.simulatable}
                title={simulatorDisabledReason}
                onClick={() => {
                  if (!selectedTemplate || !selectedTemplate.simulatable) return
                  useSimulationStore.getState().stop()
                  useCanvasStore.getState().setMode('simulate')
                  setBanner(
                    'Simulation view — press Start simulation in the top bar when ready.',
                  )
                }}
                className="w-full rounded border border-violet-600/60 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 transition-colors duration-200 hover:border-violet-500 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Simulator
              </button>
            ) : null}
          </>
        )}
      </div>

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
            ? () => navigate('/login')
            : deployRequestMessage?.actionLabel === UPGRADE_TO_ENGINEER_LABEL
              ? () => {
                  void startEngineerCheckout().catch((err: unknown) => {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : 'Could not start checkout.'
                    setBanner(msg)
                    setDeployRequestMessage((prev) =>
                      prev ? { ...prev, body: msg } : prev,
                    )
                  })
                }
              : deployRequestMessage?.actionLabel
                ? () => navigate('/login')
                : undefined
        }
        onAuthDismiss={dismissAuthModal}
        simulationRecommended={deploySimulationMessage}
        onClose={() => {
          setDeployModalOpen(false)
          setDeployModalMode('progress')
          setDeployRequestMessage(null)
          setDeploySimulationMessage(null)
          setDeployResourceBudget(null)
          setDeploying(false)
        }}
        onSimulateDesign={() => {
          useCanvasStore.getState().setMode('simulate')
          setBanner(
            'Simulation mode — explore the design without cluster provisioning.',
          )
          setDeployModalOpen(false)
          setDeployModalMode('progress')
          setDeployRequestMessage(null)
          setDeploySimulationMessage(null)
          setDeployResourceBudget(null)
          setDeploying(false)
        }}
        onModifyDesign={() => {
          setDeployModalOpen(false)
          setDeployModalMode('progress')
          setDeployRequestMessage(null)
          setDeploySimulationMessage(null)
          setDeployResourceBudget(null)
          setDeploying(false)
        }}
      />
    </aside>
  )
}
