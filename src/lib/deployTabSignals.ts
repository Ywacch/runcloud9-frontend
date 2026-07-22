import { useEffect, useRef } from 'react'
import { trackEvent } from './analytics'
import { isWaitingForProvisionSlot } from './provisionMetrics'

export const DEPLOY_TAB_BASE_TITLE = 'runcloud9'

export type DeployTabPhase =
  | 'idle'
  | 'room'
  | 'door'
  | 'provisioning'
  | 'running'
  | 'failed'

export type DeployTabSignalKind =
  | 'room_to_provisioning'
  | 'running'
  | 'failed'

export type OverlayWaitKind = 'room' | 'door' | 'provisioning'

export function deriveDeployTabPhase(opts: {
  mode: string
  deployStatus: string | null
  provisionPhase?: string | null
  provisioningError?: string | null
}): DeployTabPhase {
  if (opts.provisioningError) return 'failed'
  if (opts.mode === 'live') return 'running'
  if (opts.deployStatus === 'queued') return 'room'
  if (opts.deployStatus === 'failed') return 'failed'
  if (
    opts.deployStatus === 'provisioning' &&
    isWaitingForProvisionSlot(opts.provisionPhase)
  ) {
    return 'door'
  }
  if (
    opts.deployStatus === 'provisioning' ||
    opts.deployStatus === 'terminating'
  ) {
    return 'provisioning'
  }
  return 'idle'
}

export function steadyDeployTabTitle(phase: DeployTabPhase): string {
  switch (phase) {
    case 'room':
      return `(Waiting) ${DEPLOY_TAB_BASE_TITLE}`
    case 'door':
    case 'provisioning':
      return `(Provisioning) ${DEPLOY_TAB_BASE_TITLE}`
    case 'failed':
      return `(Failed) ${DEPLOY_TAB_BASE_TITLE}`
    case 'running':
    case 'idle':
    default:
      return DEPLOY_TAB_BASE_TITLE
  }
}

export function flashDeployTabTitle(signalKind: DeployTabSignalKind): string {
  switch (signalKind) {
    case 'room_to_provisioning':
      return `Ready to provision — ${DEPLOY_TAB_BASE_TITLE}`
    case 'running':
      return `Deploy live — ${DEPLOY_TAB_BASE_TITLE}`
    case 'failed':
      return `Deploy failed — ${DEPLOY_TAB_BASE_TITLE}`
  }
}

/** Detect a one-shot tab signal for a phase transition. */
export function deployTabSignalForTransition(
  prev: DeployTabPhase,
  next: DeployTabPhase,
): DeployTabSignalKind | null {
  if (prev === next) return null
  if (next === 'failed') return 'failed'
  if (next === 'running') return 'running'
  if (
    prev === 'room' &&
    (next === 'door' || next === 'provisioning')
  ) {
    return 'room_to_provisioning'
  }
  return null
}

export function overlayWaitKindFromFlags(opts: {
  isQueued: boolean
  isDoorwayWait: boolean
}): OverlayWaitKind {
  if (opts.isQueued) return 'room'
  if (opts.isDoorwayWait) return 'door'
  return 'provisioning'
}

const FLASH_MS = 4500

/**
 * Steady title prefix during wait/provision; flash when the tab is hidden
 * on room→provisioning, live, or failed.
 */
export function useDeployTabSignals(opts: {
  active: boolean
  template: string
  mode: string
  deployStatus: string | null
  provisionPhase?: string | null
  provisioningError?: string | null
}): void {
  const phase = deriveDeployTabPhase(opts)
  const prevPhaseRef = useRef<DeployTabPhase>('idle')
  const flashTimerRef = useRef<number | null>(null)
  const baseTitleRef = useRef(DEPLOY_TAB_BASE_TITLE)

  useEffect(() => {
    baseTitleRef.current = document.title || DEPLOY_TAB_BASE_TITLE
    return () => {
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = null
      }
      document.title = baseTitleRef.current.includes(DEPLOY_TAB_BASE_TITLE)
        ? DEPLOY_TAB_BASE_TITLE
        : baseTitleRef.current
    }
  }, [])

  useEffect(() => {
    if (!opts.active && phase === 'idle') {
      document.title = DEPLOY_TAB_BASE_TITLE
      prevPhaseRef.current = 'idle'
      return
    }

    const prev = prevPhaseRef.current
    const signal = deployTabSignalForTransition(prev, phase)
    prevPhaseRef.current = phase

    if (signal && typeof document !== 'undefined' && document.hidden) {
      trackEvent('deploy_tab_signal_shown', {
        template: opts.template,
        signalKind: signal,
      })
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current)
      }
      document.title = flashDeployTabTitle(signal)
      flashTimerRef.current = window.setTimeout(() => {
        flashTimerRef.current = null
        document.title = steadyDeployTabTitle(phase)
      }, FLASH_MS)
      return
    }

    if (flashTimerRef.current == null) {
      document.title = steadyDeployTabTitle(phase)
    }
  }, [
    opts.active,
    opts.template,
    phase,
  ])
}
