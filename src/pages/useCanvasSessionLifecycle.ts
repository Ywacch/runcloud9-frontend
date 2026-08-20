import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useActiveDeploymentPrompt,
  useCanvasStore,
  useDeploymentRehydrate,
  useLogStore,
  useLogSync,
  useMetricsStore,
  useMetricsSync,
  useSimulationStore,
  type CanvasMode,
  type CanvasNode,
} from '../editor-core'
import { deleteDeployment, getDeployment } from '../lib/api'
import {
  isWaitingForProvisionSlot,
  normalizeComponentProvisionState,
  parseProvisionMetrics,
} from '../lib/provisionMetrics'
import {
  deriveDeployWaitKind,
  readDeployQueueFields,
  shouldKeepDeployQueueFields,
  type DeployWaitKind,
} from '../lib/deployWaitAnalytics'
import { clearLiveSessionPersist } from '../lib/liveSessionStorage'
import { discardWsEventsStorage } from '../lib/wsEventsPersist'
import {
  exitLiveSessionDueToRemoteEnd,
  isTerminalDeploymentStatus,
} from '../lib/sessionCapture'
import { parseRunningAtMs } from '../lib/sessionMinutes'
import { CLIENT_LOADGEN_ID, spawnClientLoadgenNode } from '../lib/spawnClientNode'
import { trackEvent } from '../lib/analytics'
import {
  overlayWaitKindFromFlags,
  useDeployTabSignals,
  type OverlayWaitKind,
} from '../lib/deployTabSignals'

export type CanvasSessionLifecycle = {
  prompt: {
    deploymentId: string
    templateId: string
    expiresAt: string
  } | null
  rejoin: () => Promise<void>
  dismiss: () => void
  deploymentId: string | null
  mode: CanvasMode
  nodes: Record<string, CanvasNode>
  snapshotTemplateId: string | null
  deployStatus: string | null
  provisioningError: string | null
  provisioningElapsed: number
  provisionMetricsSummary: Record<string, unknown> | null
  queuePosition: number | null
  estimatedWaitSeconds: number | null
  isTerminating: boolean
  terminationMessage: string | null
  overlayMinimized: boolean
  showProvisioningOverlay: boolean
  showProvisioningError: boolean
  isQueued: boolean
  overlayWaitKind: OverlayWaitKind
  cancelProvisioning: () => void
  dismissProvisioningError: () => void
  minimizeOverlay: () => void
  expandOverlay: () => void
}

/**
 * Shared live / simulate / deploy session lifecycle for CanvasPage and SvgCanvasPage.
 * Owns rehydrate, deploy poll, metrics/log sync, sim start/stop, and overlay state.
 */
export function useCanvasSessionLifecycle(): CanvasSessionLifecycle {
  useDeploymentRehydrate()
  const { prompt, rejoin, dismiss } = useActiveDeploymentPrompt()

  const mode = useCanvasStore((s) => s.mode)
  const nodeTopologyKey = useCanvasStore((s) =>
    Object.keys(s.nodes)
      .sort()
      .join(','),
  )
  const edgeTopologyKey = useCanvasStore((s) =>
    Object.keys(s.edges)
      .sort()
      .join(','),
  )
  const simRunning = useSimulationStore((s) => s.running)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)

  const [deployStatus, setDeployStatus] = useState<string | null>(null)
  const [provisioningError, setProvisioningError] = useState<string | null>(null)
  const [provisioningElapsed, setProvisioningElapsed] = useState(0)
  const [provisionMetricsSummary, setProvisionMetricsSummary] =
    useState<Record<string, unknown> | null>(null)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState<number | null>(
    null,
  )
  const [isTerminating, setIsTerminating] = useState(false)
  const [terminationMessage, setTerminationMessage] = useState<string | null>(null)
  const [overlayMinimized, setOverlayMinimized] = useState(false)
  const provisionStartRef = useRef<number>(Date.now())
  const deploymentRunningTrackedRef = useRef<string | null>(null)
  const statusBeforeCancelRef = useRef<string | null>(null)
  const activeWaitRef = useRef<{
    kind: DeployWaitKind
    enteredAt: number
    queuePosition?: number
  } | null>(null)

  useEffect(() => {
    const st = useCanvasStore.getState()
    const restored = Boolean(st.deploymentId || st.liveSessionEndsAt || st.snapshotTemplateId)
    trackEvent('canvas_opened', { mode: restored ? 'restored' : 'new' })
  }, [])

  const realtimeDeploymentId = mode === 'live' ? deploymentId : null
  useMetricsSync(realtimeDeploymentId)
  useLogSync(realtimeDeploymentId)

  useEffect(() => {
    if (!deploymentId || mode === 'live') {
      setDeployStatus(null)
      setProvisioningError(null)
      setProvisioningElapsed(0)
      setProvisionMetricsSummary(null)
      setQueuePosition(null)
      setEstimatedWaitSeconds(null)
      setIsTerminating(false)
      return
    }

    let cancelled = false
    let stopped = false
    let pollId: number | null = null
    let timerId: number | null = null
    const stopPolling = () => {
      if (stopped) return
      stopped = true
      if (pollId !== null) window.clearInterval(pollId)
      if (timerId !== null) window.clearInterval(timerId)
    }

    provisionStartRef.current = Date.now()
    deploymentRunningTrackedRef.current = null
    activeWaitRef.current = null
    setOverlayMinimized(false)
    setDeployStatus('provisioning')
    setProvisioningError(null)
    setProvisionMetricsSummary(null)
    setQueuePosition(null)
    setEstimatedWaitSeconds(null)
    const st = useCanvasStore.getState()
    Object.keys(st.nodes).forEach((nid) => {
      if (st.nodes[nid]?.type === 'client') return
      st.updateNodeStatus(nid, 'provisioning')
    })

    const toMs = (expiresAt: string): number | null => {
      const t = Date.parse(expiresAt)
      return Number.isFinite(t) ? t : null
    }

    const templateName = () =>
      useCanvasStore.getState().snapshotTemplateId ?? 'unknown'

    const leaveActiveWait = (
      outcome: 'promoted' | 'cancelled' | 'failed' | 'terminated',
    ) => {
      const active = activeWaitRef.current
      if (!active) return
      const props: {
        template: string
        waitKind: DeployWaitKind
        outcome: typeof outcome
        waitSeconds: number
        queuePosition?: number
      } = {
        template: templateName(),
        waitKind: active.kind,
        outcome,
        waitSeconds: Math.max(
          0,
          Math.floor((Date.now() - active.enteredAt) / 1000),
        ),
      }
      if (active.queuePosition != null) {
        props.queuePosition = active.queuePosition
      }
      trackEvent('deploy_wait_left', props)
      activeWaitRef.current = null
    }

    const syncWaitAnalytics = (
      status: string,
      provisionPhase: string | undefined,
      fields: {
        queuePosition: number | null
        estimatedWaitSeconds: number | null
      },
    ) => {
      const kind = deriveDeployWaitKind(status, provisionPhase)
      const active = activeWaitRef.current
      if (kind) {
        if (active && active.kind !== kind) {
          leaveActiveWait('promoted')
        }
        if (!activeWaitRef.current || activeWaitRef.current.kind !== kind) {
          const enterProps: {
            template: string
            waitKind: DeployWaitKind
            queuePosition?: number
            estimatedWaitSeconds?: number
          } = {
            template: templateName(),
            waitKind: kind,
          }
          if (fields.queuePosition != null) {
            enterProps.queuePosition = fields.queuePosition
          }
          if (fields.estimatedWaitSeconds != null) {
            enterProps.estimatedWaitSeconds = fields.estimatedWaitSeconds
          }
          trackEvent('deploy_wait_entered', enterProps)
          activeWaitRef.current = {
            kind,
            enteredAt: Date.now(),
            ...(fields.queuePosition != null
              ? { queuePosition: fields.queuePosition }
              : {}),
          }
        } else if (
          fields.queuePosition != null &&
          activeWaitRef.current.queuePosition !== fields.queuePosition
        ) {
          activeWaitRef.current = {
            ...activeWaitRef.current,
            queuePosition: fields.queuePosition,
          }
        }
        return
      }
      if (activeWaitRef.current) {
        if (status === 'failed') leaveActiveWait('failed')
        else if (status === 'terminated') {
          leaveActiveWait(
            statusBeforeCancelRef.current ? 'cancelled' : 'terminated',
          )
        } else leaveActiveWait('promoted')
      }
    }

    const pollOnce = async () => {
      try {
        const dep = await getDeployment(deploymentId)
        if (cancelled) return
        setDeployStatus(dep.status)

        const polled = parseProvisionMetrics(dep.metricsSummary)
        const fields = readDeployQueueFields(dep)
        if (shouldKeepDeployQueueFields(dep.status, polled?.provisionPhase)) {
          setQueuePosition(fields.queuePosition)
          setEstimatedWaitSeconds(
            fields.estimatedWaitSeconds != null
              ? fields.estimatedWaitSeconds
              : dep.status === 'queued'
                ? 240
                : null,
          )
        } else {
          setQueuePosition(null)
          setEstimatedWaitSeconds(null)
        }

        setProvisionMetricsSummary(
          dep.metricsSummary && typeof dep.metricsSummary === 'object'
            ? (dep.metricsSummary as Record<string, unknown>)
            : null,
        )

        syncWaitAnalytics(dep.status, polled?.provisionPhase, fields)

        if (polled && Object.keys(polled.componentStatus).length > 0) {
          const stNodes = useCanvasStore.getState()
          for (const [nid, raw] of Object.entries(polled.componentStatus)) {
            const node = stNodes.nodes[nid]
            if (!node || node.type === 'client') continue
            const ns = normalizeComponentProvisionState(raw)
            if (ns === 'ready') stNodes.updateNodeStatus(nid, 'healthy')
            else if (ns === 'failed') stNodes.updateNodeStatus(nid, 'degraded')
            else stNodes.updateNodeStatus(nid, 'provisioning')
          }
        }

        if (dep.status === 'running') {
          if (deploymentRunningTrackedRef.current !== deploymentId) {
            deploymentRunningTrackedRef.current = deploymentId
            const elapsedSeconds = Math.floor(
              (Date.now() - provisionStartRef.current) / 1000,
            )
            trackEvent('deployment_running', {
              template: templateName(),
              elapsedSeconds,
            })
          }
          const endsAt = toMs(dep.expiresAt) ?? Date.now() + 9 * 60 * 1000
          const runningAt = parseRunningAtMs(dep.metricsSummary)
          const live = useCanvasStore.getState()
          Object.keys(live.nodes).forEach((nid) => {
            if (live.nodes[nid]?.type === 'client') return
            live.updateNodeStatus(nid, 'healthy')
          })
          live.setMode('live')
          live.setAllEdgesAnimated(true)
          live.setLiveSessionStartedAt(runningAt ?? Date.now())
          live.setLiveSessionEndsAt(endsAt)
          // Keep the current selection when entering live so the inspector stays open
          // while metrics stream in (clearing here caused an empty sidebar race).
          live.setPendingSource(null)
          live.setPlacingNodeType(null)
          live.setDesignTool('select')
          spawnClientLoadgenNode()
          if (polled?.loadgenStatus === 'failed') {
            const liveAfterSpawn = useCanvasStore.getState()
            if (liveAfterSpawn.nodes[CLIENT_LOADGEN_ID]) {
              liveAfterSpawn.updateNodeStatus(CLIENT_LOADGEN_ID, 'degraded')
            }
          }
          discardWsEventsStorage(deploymentId)
          useMetricsStore.getState().clearMetrics()
          useLogStore.getState().clearLogs()
          const liveWarnings: string[] = []
          if (polled?.seedingStatus === 'failed') {
            liveWarnings.push(
              'Live session started, but data seeding reported a failure. Metrics may be incomplete.',
            )
          }
          if (polled?.loadgenStatus === 'failed') {
            liveWarnings.push(
              'Live session started, but the load generator pod failed to deploy. Load testing may be unavailable.',
            )
          }
          if (liveWarnings.length > 0) {
            useMetricsStore.getState().setStreamWarning(liveWarnings.join(' '))
          }
          stopPolling()
          return
        }
        if (dep.status === 'failed') {
          trackEvent('deployment_failed', {
            template: templateName(),
            phase: 'provision',
            errorCategory: 'server',
          })
          setProvisioningError('Deployment failed during provisioning.')
          setIsTerminating(false)
          stopPolling()
          return
        }
        if (dep.status === 'terminated') {
          const stTerminated = useCanvasStore.getState()
          stTerminated.setDeploymentId(null)
          stTerminated.setLiveSessionEndsAt(null)
          stTerminated.setLiveSessionStartedAt(null)
          stTerminated.setMode('design')
          stTerminated.setAllEdgesAnimated(false)
          Object.keys(stTerminated.nodes).forEach((nid) => {
            if (stTerminated.nodes[nid]?.type === 'client') return
            stTerminated.updateNodeStatus(nid, 'idle')
          })
          clearLiveSessionPersist()
          setIsTerminating(false)
          setDeployStatus(null)
          setProvisioningError(null)
          setQueuePosition(null)
          setEstimatedWaitSeconds(null)
          setTerminationMessage(
            statusBeforeCancelRef.current === 'queued'
              ? 'Left the queue. Deployment cancelled.'
              : 'Provisioning cancelled. Deployment terminated.',
          )
          statusBeforeCancelRef.current = null
          stopPolling()
          return
        }
      } catch {
        // Transient errors are ignored; next interval retries.
      }
    }

    void pollOnce()
    pollId = window.setInterval(() => {
      void pollOnce()
    }, 2500)
    timerId = window.setInterval(() => {
      setProvisioningElapsed(
        Math.floor((Date.now() - provisionStartRef.current) / 1000),
      )
    }, 1000)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [deploymentId, mode])

  useEffect(() => {
    if (!terminationMessage) return
    const id = window.setTimeout(() => setTerminationMessage(null), 3500)
    return () => window.clearTimeout(id)
  }, [terminationMessage])

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
      Object.values(st.edges),
    )
  }, [mode, simRunning, nodeTopologyKey, edgeTopologyKey])

  const showProvisioningOverlay =
    mode !== 'live' &&
    !!deploymentId &&
    (deployStatus === 'queued' ||
      deployStatus === 'provisioning' ||
      isTerminating)
  const showProvisioningError = mode !== 'live' && !!deploymentId && !!provisioningError
  const isQueued = deployStatus === 'queued'
  const provisionPhase = useMemo(
    () => parseProvisionMetrics(provisionMetricsSummary)?.provisionPhase,
    [provisionMetricsSummary],
  )
  const isDoorwayWait =
    !isQueued && isWaitingForProvisionSlot(provisionPhase)
  const overlayWaitKind = overlayWaitKindFromFlags({
    isQueued,
    isDoorwayWait,
  })

  useEffect(() => {
    if (provisioningError) setOverlayMinimized(false)
  }, [provisioningError])

  useDeployTabSignals({
    active: Boolean(
      deploymentId &&
        (showProvisioningOverlay || showProvisioningError || mode === 'live'),
    ),
    template: snapshotTemplateId ?? 'unknown',
    mode,
    deployStatus,
    provisionPhase,
    provisioningError,
  })

  const cancelProvisioning = useCallback(() => {
    if (!deploymentId || isTerminating) return
    statusBeforeCancelRef.current =
      deployStatus === 'queued' || deployStatus === 'provisioning'
        ? deployStatus
        : 'provisioning'
    setIsTerminating(true)
    setDeployStatus('terminating')
    setTerminationMessage(null)
    void deleteDeployment(deploymentId).catch((err) => {
      const msg =
        err instanceof Error
          ? err.message
          : statusBeforeCancelRef.current === 'queued'
            ? 'Could not leave the queue. Please try again.'
            : 'Could not cancel provisioning. Please try again.'
      setIsTerminating(false)
      setDeployStatus(
        statusBeforeCancelRef.current === 'queued'
          ? 'queued'
          : 'provisioning',
      )
      setTerminationMessage(msg)
    })
  }, [deploymentId, isTerminating, deployStatus])

  const dismissProvisioningError = useCallback(() => {
    const st = useCanvasStore.getState()
    st.setDeploymentId(null)
    st.setLiveSessionEndsAt(null)
    st.setLiveSessionStartedAt(null)
    st.setMode('design')
    st.setAllEdgesAnimated(false)
    Object.keys(st.nodes).forEach((nid) => {
      if (st.nodes[nid]?.type === 'client') return
      st.updateNodeStatus(nid, 'idle')
    })
    clearLiveSessionPersist()
    setProvisioningError(null)
    setDeployStatus(null)
  }, [])

  const minimizeOverlay = useCallback(() => {
    setOverlayMinimized(true)
    trackEvent('overlay_minimized', {
      template: snapshotTemplateId ?? 'unknown',
      waitKind: overlayWaitKind,
    })
  }, [snapshotTemplateId, overlayWaitKind])

  const expandOverlay = useCallback(() => {
    setOverlayMinimized(false)
    trackEvent('overlay_expanded', {
      template: snapshotTemplateId ?? 'unknown',
      waitKind: overlayWaitKind,
    })
  }, [snapshotTemplateId, overlayWaitKind])

  return {
    prompt,
    rejoin,
    dismiss,
    deploymentId,
    mode,
    nodes,
    snapshotTemplateId,
    deployStatus,
    provisioningError,
    provisioningElapsed,
    provisionMetricsSummary,
    queuePosition,
    estimatedWaitSeconds,
    isTerminating,
    terminationMessage,
    overlayMinimized,
    showProvisioningOverlay,
    showProvisioningError,
    isQueued,
    overlayWaitKind,
    cancelProvisioning,
    dismissProvisioningError,
    minimizeOverlay,
    expandOverlay,
  }
}
