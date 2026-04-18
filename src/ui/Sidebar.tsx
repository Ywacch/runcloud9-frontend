import { type DragEvent, useCallback, useEffect, useState } from 'react'
import {
  type DeploymentResult,
  createDeployment,
  deleteDeployment,
} from '../lib/api'
import { snapshotToDeploymentDesign } from '../lib/deployPayload'
import {
  clearLiveSessionPersist,
  persistLiveSession,
} from '../lib/liveSessionStorage'
import { captureSessionSummary } from '../lib/sessionCapture'
import {
  CLIENT_LOADGEN_ID,
} from '../lib/spawnClientNode'
import { useCanvasStore, type CanvasNode } from '../store/canvasStore'
import { useLogStore } from '../store/logStore'
import { useMetricsStore } from '../store/metricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { DeployModal, type DeployStep } from './DeployModal'
import { RationalePanel } from './RationalePanel'
import { TemplateModal, templateTitleForId } from './TemplateModal'

const DEPLOYABLE_TEMPLATES: string[] = ['url-shortener']

const SIDEBAR_COLLAPSED_KEY = 'cloud9.sidebarCollapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const PALETTE: { type: CanvasNode['type']; title: string; face: string }[] = [
  { type: 'load_balancer', title: 'Load Balancer', face: '#4A90D9' },
  { type: 'compute', title: 'App Server', face: '#8A9BB0' },
  { type: 'database', title: 'Database', face: '#5C6B7A' },
  { type: 'cache', title: 'Cache', face: '#C0392B' },
  { type: 'message_queue', title: 'Message Queue', face: '#E05E8A' },
  { type: 'worker', title: 'Worker', face: '#A78BFA' },
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
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const setPlacingNodeType = useCanvasStore((s) => s.setPlacingNodeType)
  const setDesignTool = useCanvasStore((s) => s.setDesignTool)

  const [deploying, setDeploying] = useState(false)
  const [tearing, setTearing] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [deploySteps, setDeploySteps] = useState<DeployStep[]>([])
  const [deployModalOpen, setDeployModalOpen] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deploySimulationMessage, setDeploySimulationMessage] = useState<
    string | null
  >(null)
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const proceedWithDeployResult = useCallback((result: DeploymentResult) => {
    const st = useCanvasStore.getState()
    const id = result.deploymentId
    setDeploySteps((s) =>
      s.map((step) =>
        step.id === 'provision'
          ? {
              ...step,
              state: 'active' as const,
              detail: 'Provisioning in progress... open canvas to watch status',
            }
          : step.id === 'ready'
            ? {
                ...step,
                state: 'pending' as const,
                detail: 'Waiting for infrastructure to become running',
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
    setBanner('Deployment submitted. Provisioning started...')
    persistLiveSession(id, useCanvasStore.getState().exportJSON())
    setDeployModalOpen(false)
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
  const simRunning = useSimulationStore((s) => s.running)

  const togglePlace = (type: CanvasNode['type']) => {
    if (placingNodeType === type) {
      setPlacingNodeType(null)
    } else {
      setDesignTool('select')
      setPlacingNodeType(type)
    }
  }

  const onDragStart =
    (type: CanvasNode['type']) => (e: DragEvent) => {
      e.dataTransfer.setData('application/cloud9-node-type', type)
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0)
    }

  const handleDeploy = async () => {
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
    const templateId = stCheck.snapshotTemplateId
    if (templateId && !DEPLOYABLE_TEMPLATES.includes(templateId)) {
      setAlertMsg(
        `The "${templateTitleForId(templateId) ?? templateId}" template is not deployable yet.\n\nOnly URL Shortener is available in this release.`,
      )
      return
    }

    setDeploying(true)
    setBanner(null)
    setDeployModalOpen(true)
    setDeployError(null)
    setDeploySimulationMessage(null)
    setDeploySteps([
      {
        id: 'validate',
        label: 'Validating topology',
        state: 'active',
        detail: 'Checking connections and configs...',
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
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : 'Deploy failed')
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
  }

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
      captureSessionSummary()
      st.setMode('design')
      st.setDeploymentId(null)
      st.setLiveSessionEndsAt(null)
      st.setAllEdgesAnimated(false)
      useMetricsStore.getState().clearMetrics()
      useLogStore.getState().clearLogs()
      Object.keys(st.nodes).forEach((nid) => {
        st.updateNodeStatus(nid, 'idle')
      })
      clearLiveSessionPersist()
      setBanner('Returned to design mode.')
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Teardown failed')
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
      className={`relative flex h-full shrink-0 flex-col bg-gray-900 text-white transition-[width] duration-200 ease-out ${
        collapsed ? 'w-12' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-gray-800 p-2">
        {!collapsed ? (
          <h1 className="min-w-0 truncate pl-2 text-lg font-semibold tracking-tight">
            Cloud9
          </h1>
        ) : (
          <span className="sr-only">Cloud9</span>
        )}
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      <div
        className={`flex-1 space-y-3 overflow-y-auto p-4 ${
          collapsed ? 'hidden' : ''
        }`}
      >
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Templates
        </h2>
        <button
          type="button"
          disabled={live || simulate}
          onClick={() => setTemplateModalOpen(true)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-40"
        >
          <span className="text-xs uppercase tracking-wider text-gray-400">
            Template
          </span>
          <div className="mt-1">
            {templateTitleForId(snapshotTemplateId) ?? 'Choose a template…'}
          </div>
        </button>
        <TemplateModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSelect={(preset, id) => {
            const st = useCanvasStore.getState()
            if (Object.keys(st.nodes).length > 0) {
              if (!window.confirm('Replace current design?')) return false
            }
            useSimulationStore.getState().stop()
            st.loadTemplateSnapshot(preset(), 'design')
            setBanner(`Loaded ${templateTitleForId(id) ?? id} template`)
          }}
        />

        <h2 className="pt-2 text-xs font-medium uppercase tracking-wider text-gray-400">
          Components
        </h2>
        <p className="text-xs leading-snug text-gray-500">
          Drag onto the canvas, or click a component then click the grid. Esc cancels.
        </p>
        {placingNodeType ? (
          <p className="text-xs text-amber-200/90">
            Placing: click the grid. Press Esc to cancel.
          </p>
        ) : null}
        {banner ? (
          <p className="rounded border border-gray-700 bg-gray-800/80 px-2 py-1.5 text-xs text-gray-200">
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
                  className={`flex w-full items-center gap-3 rounded-md border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-left text-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 ${
                    placing ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-900' : ''
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
        {!live ? <RationalePanel /> : null}
      </div>
      <div
        className={`space-y-2 border-t border-gray-800 p-4 ${
          collapsed ? 'hidden' : ''
        }`}
      >
        {statusLine ? (
          <p className="text-center text-xs text-gray-400">{statusLine}</p>
        ) : null}
        {live ? (
          <button
            type="button"
            disabled={tearing}
            onClick={handleTeardown}
            className="w-full rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
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
              className="w-full rounded border border-amber-600/70 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-500 hover:bg-amber-900/40"
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
              className="w-full rounded bg-violet-800 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Exit simulation
            </button>
          </>
        ) : (
          <>
            {nodeCount > 0 && snapshotTemplateId ? (
              <button
                type="button"
                onClick={() => {
                  useSimulationStore.getState().stop()
                  useCanvasStore.getState().setMode('simulate')
                  setBanner(
                    'Simulation view — press Start simulation in the top bar when ready.',
                  )
                }}
                className="w-full rounded border border-violet-600/60 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 hover:border-violet-500 hover:bg-violet-900/40"
              >
                Simulator
              </button>
            ) : null}
            <button
              type="button"
              disabled={deploying || nodeCount === 0 || !snapshotTemplateId}
              title={
                !snapshotTemplateId
                  ? 'Choose a template from the Templates section first'
                  : undefined
              }
              onClick={handleDeploy}
              className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Deploy
            </button>
          </>
        )}
      </div>

      {alertMsg ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-white">
              Template Not Available
            </h3>
            <p className="mt-2 whitespace-pre-line text-xs text-gray-400">
              {alertMsg}
            </p>
            <button
              type="button"
              onClick={() => setAlertMsg(null)}
              className="mt-4 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      <DeployModal
        open={deployModalOpen}
        steps={deploySteps}
        error={deployError}
        simulationRecommended={deploySimulationMessage}
        onClose={() => {
          setDeployModalOpen(false)
          setDeployError(null)
          setDeploySimulationMessage(null)
          setDeploying(false)
        }}
        onSimulateDesign={() => {
          useCanvasStore.getState().setMode('simulate')
          setBanner(
            'Simulation mode — explore the design without cluster provisioning.',
          )
          setDeployModalOpen(false)
          setDeploySimulationMessage(null)
          setDeploying(false)
        }}
        onModifyDesign={() => {
          setDeployModalOpen(false)
          setDeploySimulationMessage(null)
          setDeploying(false)
        }}
      />
    </aside>
  )
}
