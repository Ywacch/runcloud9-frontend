import { useEffect, useRef, useState } from 'react'
import { CanvasRoot } from '../canvas/CanvasRoot'
import { useCanvasKeyboard } from '../hooks/useCanvasKeyboard'
import { useDeploymentRehydrate } from '../hooks/useDeploymentRehydrate'
import { useActiveDeploymentPrompt } from '../hooks/useActiveDeploymentPrompt'
import { useLogSync } from '../hooks/useLogSync'
import { useMetricsSync } from '../hooks/useMetricsSync'
import { getDeployment } from '../lib/api'
import { clearLiveSessionPersist } from '../lib/liveSessionStorage'
import {
  exitLiveSessionDueToRemoteEnd,
  isTerminalDeploymentStatus,
} from '../lib/sessionCapture'
import { dispatchSpawnAtScreen } from '../lib/spawnEvents'
import { spawnClientLoadgenNode } from '../lib/spawnClientNode'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasNode,
} from '../store/canvasStore'
import { useLogStore } from '../store/logStore'
import { useMetricsStore } from '../store/metricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { DesignToolStrip } from '../ui/DesignToolStrip'
import { InspectorPanel } from '../ui/InspectorPanel'
import { DeploymentPlayground } from '../ui/DeploymentPlayground'
import { LiveOverlay } from '../ui/LiveOverlay'
import { SimulationOverlay } from '../ui/SimulationOverlay'
import { LogPanel } from '../ui/LogPanel'
import { CanvasErrorBoundary } from '../ui/CanvasErrorBoundary'
import { SessionSummary } from '../ui/SessionSummary'
import { Sidebar } from '../ui/Sidebar'
import { SystemTopBar } from '../ui/SystemTopBar'
import { EventTimeline } from '../ui/EventTimeline'
import { CascadeToast } from '../ui/CascadeToast'
import { RejoinBanner } from '../ui/RejoinBanner'

const VALID_TYPES: CanvasNode['type'][] = [
  'load_balancer',
  'compute',
  'database',
  'cache',
  'message_queue',
  'worker',
]

function isNodeType(raw: string): raw is CanvasNode['type'] {
  return (VALID_TYPES as string[]).includes(raw)
}

export default function CanvasPage() {
  useDeploymentRehydrate()
  const { prompt, rejoin, dismiss } = useActiveDeploymentPrompt()
  useCanvasKeyboard()
  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const designTool = useCanvasStore((s) => s.designTool)
  const mode = useCanvasStore((s) => s.mode)
  const nodeTopologyKey = useCanvasStore((s) =>
    Object.keys(s.nodes)
      .sort()
      .join(',')
  )
  const edgeTopologyKey = useCanvasStore((s) =>
    Object.keys(s.edges)
      .sort()
      .join(',')
  )
  const simRunning = useSimulationStore((s) => s.running)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const [deployStatus, setDeployStatus] = useState<string | null>(null)
  const [provisioningError, setProvisioningError] = useState<string | null>(null)
  const [provisioningElapsed, setProvisioningElapsed] = useState(0)
  const provisionStartRef = useRef<number>(Date.now())

  const realtimeDeploymentId = mode === 'live' ? deploymentId : null
  useMetricsSync(realtimeDeploymentId)
  useLogSync(realtimeDeploymentId)

  useEffect(() => {
    if (!deploymentId || mode === 'live') {
      setDeployStatus(null)
      setProvisioningError(null)
      setProvisioningElapsed(0)
      return
    }

    let cancelled = false
    provisionStartRef.current = Date.now()
    setDeployStatus('provisioning')
    setProvisioningError(null)
    const st = useCanvasStore.getState()
    Object.keys(st.nodes).forEach((nid) => {
      if (st.nodes[nid]?.type === 'client') return
      st.updateNodeStatus(nid, 'provisioning')
    })

    const toMs = (expiresAt: string): number | null => {
      const t = Date.parse(expiresAt)
      return Number.isFinite(t) ? t : null
    }

    const pollOnce = async () => {
      try {
        const dep = await getDeployment(deploymentId)
        if (cancelled) return
        setDeployStatus(dep.status)
        if (dep.status === 'running') {
          const endsAt = toMs(dep.expiresAt) ?? Date.now() + 9 * 60 * 1000
          const live = useCanvasStore.getState()
          Object.keys(live.nodes).forEach((nid) => {
            if (live.nodes[nid]?.type === 'client') return
            live.updateNodeStatus(nid, 'healthy')
          })
          live.setMode('live')
          live.setAllEdgesAnimated(true)
          live.setLiveSessionEndsAt(endsAt)
          live.selectNode(null)
          live.setPendingSource(null)
          live.setPlacingNodeType(null)
          live.setDesignTool('select')
          spawnClientLoadgenNode()
          useMetricsStore.getState().clearMetrics()
          useLogStore.getState().clearLogs()
          return
        }
        if (dep.status === 'failed' || dep.status === 'terminated') {
          setProvisioningError('Deployment failed during provisioning.')
          return
        }
      } catch {
        // Transient errors are ignored; next interval retries.
      }
    }

    void pollOnce()
    const pollId = window.setInterval(() => {
      void pollOnce()
    }, 2000)
    const timerId = window.setInterval(() => {
      setProvisioningElapsed(
        Math.floor((Date.now() - provisionStartRef.current) / 1000),
      )
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      window.clearInterval(timerId)
    }
  }, [deploymentId, mode])

  useEffect(() => {
    if (mode !== 'live') return
    if (!deploymentId) return
    if (!useCanvasStore.getState().liveSessionEndsAt) return

    const tick = window.setInterval(() => {
      const now = Date.now()
      const st = useCanvasStore.getState()
      const endsAt = st.liveSessionEndsAt
      if (!endsAt || now < endsAt) return
      void getDeployment(deploymentId)
        .then((dep) => {
          if (isTerminalDeploymentStatus(dep.status)) {
            window.clearInterval(tick)
            exitLiveSessionDueToRemoteEnd()
            return
          }
          useMetricsStore
            .getState()
            .setStreamWarning(
              'Session end is pending confirmation from the backend. Retrying...',
            )
        })
        .catch(() => {
          useMetricsStore
            .getState()
            .setStreamWarning(
              'Could not confirm session end. Staying in live view and retrying...',
            )
        })
    }, 1000)

    return () => window.clearInterval(tick)
  }, [mode, deploymentId])

  useEffect(() => {
    if (mode !== 'simulate') {
      useSimulationStore.getState().stop()
      return
    }
    spawnClientLoadgenNode()
    return () => {
      useSimulationStore.getState().stop()
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'simulate' || !simRunning) return
    const st = useCanvasStore.getState()
    useSimulationStore.getState().reinitTopology(
      Object.values(st.nodes),
      Object.values(st.edges)
    )
  }, [mode, simRunning, nodeTopologyKey, edgeTopologyKey])

  const showProvisioningOverlay =
    mode !== 'live' && !!deploymentId && deployStatus === 'provisioning'
  const showProvisioningError = mode !== 'live' && !!deploymentId && !!provisioningError

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <SessionSummary />
      <Sidebar />
      <div
        className={`relative min-w-0 flex-1 ${
          placingNodeType ||
            (isCanvasEditMode(mode) && designTool === 'connect')
            ? 'cursor-crosshair'
            : ''
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (useCanvasStore.getState().mode === 'live') return
          const raw = e.dataTransfer.getData('application/cloud9-node-type')
          if (!isNodeType(raw)) return
          dispatchSpawnAtScreen({
            clientX: e.clientX,
            clientY: e.clientY,
            nodeType: raw,
          })
        }}
      >
        <CanvasErrorBoundary resetKey={mode}>
          <CanvasRoot />
        </CanvasErrorBoundary>
        {/* Rejoin must show in design mode too (default when opening /canvas). */}
        {prompt ? (
          <div className="pointer-events-none absolute left-3 top-3 z-40 flex w-fit max-w-[min(100%,28rem)] min-w-0 pr-3">
            <RejoinBanner
              deploymentName={prompt.deploymentId}
              expiresAt={prompt.expiresAt}
              onRejoin={() => {
                void rejoin()
              }}
              onDismiss={dismiss}
            />
          </div>
        ) : null}
        {mode !== 'design' ? (
          <div className="pointer-events-none absolute left-3 top-0 z-30 flex w-fit max-w-[50%] min-w-0 flex-col gap-2 pr-3 pt-3">
            <SystemTopBar />
            <EventTimeline />
            <div className="pointer-events-auto flex w-full min-w-0 flex-col gap-2">
              <LiveOverlay />
              <SimulationOverlay />
            </div>
          </div>
        ) : null}
        {showProvisioningOverlay ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900/90 p-5 text-white shadow-xl">
              <h3 className="text-lg font-semibold">Provisioning Infrastructure</h3>
              <p className="mt-2 text-sm text-gray-300">
                Deployment is being created. This usually takes 60-120 seconds.
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded bg-gray-800">
                <div className="h-full w-1/3 animate-pulse bg-blue-500" />
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Deploying pods... {provisioningElapsed}s elapsed
              </p>
            </div>
          </div>
        ) : null}
        {showProvisioningError ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-red-800 bg-gray-900/95 p-5 text-white shadow-xl">
              <h3 className="text-lg font-semibold text-red-300">Provisioning Failed</h3>
              <p className="mt-2 text-sm text-gray-300">{provisioningError}</p>
              <button
                type="button"
                className="mt-4 w-full rounded bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
                onClick={() => {
                  const st = useCanvasStore.getState()
                  st.setDeploymentId(null)
                  st.setLiveSessionEndsAt(null)
                  st.setMode('design')
                  st.setAllEdgesAnimated(false)
                  Object.keys(st.nodes).forEach((nid) => {
                    if (st.nodes[nid]?.type === 'client') return
                    st.updateNodeStatus(nid, 'idle')
                  })
                  clearLiveSessionPersist()
                  setProvisioningError(null)
                  setDeployStatus(null)
                }}
              >
                Back to design
              </button>
            </div>
          </div>
        ) : null}
        <DeploymentPlayground />
        <LogPanel />
        <DesignToolStrip />
        <InspectorPanel />
        {mode === 'live' ? <CascadeToast /> : null}
      </div>
    </div>
  )
}
