import { useEffect, useRef, useState } from 'react'
import { CanvasRoot } from '../canvas/CanvasRoot'
import { useCanvasKeyboard } from '../hooks/useCanvasKeyboard'
import { useDeploymentRehydrate } from '../hooks/useDeploymentRehydrate'
import { useLogSync } from '../hooks/useLogSync'
import { useMetricsSync } from '../hooks/useMetricsSync'
import { getDeployment } from '../lib/api'
import { clearLiveSessionPersist } from '../lib/liveSessionStorage'
import { exitLiveSessionDueToRemoteEnd } from '../lib/sessionCapture'
import { dispatchSpawnAtScreen } from '../lib/spawnEvents'
import { spawnClientLoadgenNode } from '../lib/spawnClientNode'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasNode,
} from '../store/canvasStore'
import { useLogStore } from '../store/logStore'
import { useMetricsStore } from '../store/metricsStore'
import { DesignToolStrip } from '../ui/DesignToolStrip'
import { InspectorPanel } from '../ui/InspectorPanel'
import { DeploymentPlayground } from '../ui/DeploymentPlayground'
import { LiveOverlay } from '../ui/LiveOverlay'
import { LogPanel } from '../ui/LogPanel'
import { CanvasErrorBoundary } from '../ui/CanvasErrorBoundary'
import { SessionSummary } from '../ui/SessionSummary'
import { Sidebar } from '../ui/Sidebar'

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
  useCanvasKeyboard()
  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const designTool = useCanvasStore((s) => s.designTool)
  const mode = useCanvasStore((s) => s.mode)
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
    if (!useCanvasStore.getState().liveSessionEndsAt) return

    const tick = window.setInterval(() => {
      const now = Date.now()
      const st = useCanvasStore.getState()
      const endsAt = st.liveSessionEndsAt
      if (!endsAt || now < endsAt) return
      window.clearInterval(tick)
      exitLiveSessionDueToRemoteEnd()
    }, 1000)

    return () => window.clearInterval(tick)
  }, [mode, deploymentId])

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
          const raw = e.dataTransfer.getData('application/cloud9-node-type')
          if (!isNodeType(raw)) return
          dispatchSpawnAtScreen({
            clientX: e.clientX,
            clientY: e.clientY,
            nodeType: raw,
          })
        }}
      >
        <CanvasErrorBoundary>
          <CanvasRoot />
        </CanvasErrorBoundary>
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
        <LiveOverlay />
        <DeploymentPlayground />
        <LogPanel />
        <DesignToolStrip />
        <InspectorPanel />
      </div>
    </div>
  )
}
