import { ApiError } from './apiError'
import { isResourceBudgetApiError } from './resourceBudgetError'
import {
  isDesignExceedsClusterCapacity,
  isMonthlySessionLimitError,
  isQueueFullErrorMessage,
  isUserConcurrentDeployErrorMessage,
} from './deployQueue'
import { isWaitingForProvisionSlot } from './provisionMetrics'

export type DeployWaitKind = 'room' | 'door'

export type DeployWaitOutcome =
  | 'promoted'
  | 'cancelled'
  | 'failed'
  | 'terminated'

export type DeployRejectReason =
  | 'design_exceeds_cluster'
  | 'queue_full'
  | 'concurrent_active'
  | 'monthly_session_limit'
  | 'resource_budget'

export type DeployAdmitStatus = 'provisioning' | 'queued'

/** Room queue or doorway semaphore wait — mutually exclusive (queued wins). */
export function deriveDeployWaitKind(
  status: string | null | undefined,
  provisionPhase?: string | null,
): DeployWaitKind | null {
  if (status === 'queued') return 'room'
  if (
    status === 'provisioning' &&
    isWaitingForProvisionSlot(provisionPhase)
  ) {
    return 'door'
  }
  return null
}

/** Keep top-level queuePosition / estimatedWaitSeconds for room or door wait. */
export function shouldKeepDeployQueueFields(
  status: string | null | undefined,
  provisionPhase?: string | null,
): boolean {
  return deriveDeployWaitKind(status, provisionPhase) != null
}

export function readDeployQueueFields(dep: {
  queuePosition?: number
  estimatedWaitSeconds?: number
}): {
  queuePosition: number | null
  estimatedWaitSeconds: number | null
} {
  const queuePosition =
    typeof dep.queuePosition === 'number' && Number.isFinite(dep.queuePosition)
      ? dep.queuePosition
      : null
  const estimatedWaitSeconds =
    typeof dep.estimatedWaitSeconds === 'number' &&
    Number.isFinite(dep.estimatedWaitSeconds)
      ? dep.estimatedWaitSeconds
      : null
  return { queuePosition, estimatedWaitSeconds }
}

export function deployAdmitStatusFromCreate(
  status: string | null | undefined,
): DeployAdmitStatus {
  return status === 'queued' ? 'queued' : 'provisioning'
}

export function deployRejectReasonFromError(
  error: unknown,
): DeployRejectReason | undefined {
  if (isResourceBudgetApiError(error)) return 'resource_budget'
  if (!(error instanceof ApiError)) return undefined
  const raw = error.rawMessage || error.message
  if (
    isDesignExceedsClusterCapacity({
      reason: error.reason,
      message: raw,
    })
  ) {
    return 'design_exceeds_cluster'
  }
  if (error.status === 429) {
    if (isQueueFullErrorMessage(raw)) return 'queue_full'
    if (
      isMonthlySessionLimitError({
        reason: error.reason,
        message: raw,
      })
    ) {
      return 'monthly_session_limit'
    }
    if (isUserConcurrentDeployErrorMessage(raw)) return 'concurrent_active'
  }
  return undefined
}
