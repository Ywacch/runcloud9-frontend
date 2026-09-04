import { ApiError } from './apiError'
import { isResourceBudgetApiError } from './resourceBudgetError'
import {
  canvasQuotaForDisplay,
  type ResourceBudgetErrorResponse,
} from './sumDesignBudget'
import {
  isDesignExceedsClusterCapacity,
  isMonthlySessionLimitError,
  isQueueFullErrorMessage,
  isUserConcurrentDeployErrorMessage,
} from './deployQueue'
import {
  isChaosTrialUsedMessage,
} from './billingCopy'
import { isEmailUnconfirmedError } from './deployQueue'
import { scrubEmDashCopy } from './topologyRulesTypes'

export interface DeployRequestMessage {
  title: string
  body: string
  technicalDetails?: string
  actionLabel?: string
  /** Optional second CTA (e.g. switch to Free tier design). */
  secondaryActionLabel?: string
  resourceBudget?: ResourceBudgetErrorResponse
}

function technicalDetailsFrom(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return scrubEmDashCopy(raw)
}

export function mapDeployRequestError(
  error: unknown,
  opts?: { isFreeUser?: boolean; quotaTier?: string },
): DeployRequestMessage {
  if (isResourceBudgetApiError(error)) {
    const displayBudget = canvasQuotaForDisplay(
      error.budget,
      opts?.quotaTier,
    )
    return {
      title: 'Design exceeds your resource quota',
      body: 'This design needs more CPU and memory than your plan allows on the canvas. Downsize nodes, reduce replicas, or remove components before deploying.',
      technicalDetails: technicalDetailsFrom(displayBudget.error),
      resourceBudget: displayBudget,
    }
  }

  if (error instanceof ApiError) {
    const raw = error.rawMessage || error.message
    const normalized = raw.toLowerCase()

    if (error.status === 401) {
      return {
        title: 'Session expired',
        body: 'Please sign in again to deploy infrastructure.',
        actionLabel: 'Sign in',
      }
    }

    if (error.status === 403) {
      if (isEmailUnconfirmedError({ reason: error.reason, message: raw })) {
        return {
          title: 'Confirm your email',
          body: 'Confirm your email before deploying. Check your inbox for the confirmation link, then try again.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      if (isChaosTrialUsedMessage(raw)) {
        return {
          title: 'Chaos trial used',
          body: 'You used your free chaos trial for this feature.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      if (normalized.includes('premium')) {
        return {
          title: 'Template not available',
          body: 'This template is not available on your plan.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      if (
        normalized.includes('load balancers require') ||
        normalized.includes('message queues and workers') ||
        normalized.includes('proxy cache strategies require') ||
        normalized.includes('exceed your plan limit')
      ) {
        return {
          title: 'Design not supported on your plan',
          body: 'This design uses components or settings your plan does not allow. Change the design and try again.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      if (normalized.includes('you do not own this deployment')) {
        return {
          title: 'Deployment request was not accepted',
          body: 'You do not have access to this deployment.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      return {
        title: 'Deployment request was not accepted',
        body: 'You do not have permission to perform this action.',
        technicalDetails: technicalDetailsFrom(raw),
      }
    }

    if (error.status === 429) {
      if (isQueueFullErrorMessage(raw)) {
        return {
          title: 'Cluster queue is full',
          body: 'Too many deployments are waiting for capacity. Please try again in a minute.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      if (
        isMonthlySessionLimitError({
          reason: error.reason,
          message: raw,
        })
      ) {
        if (opts?.isFreeUser) {
          return {
            title: 'Out of sessions this month',
            body: 'You hit the monthly session limit. Try again next month.',
            technicalDetails: technicalDetailsFrom(raw),
          }
        }
        return {
          title: 'Out of sessions this month',
          body: 'You hit your monthly limit. Try again next month.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      if (isUserConcurrentDeployErrorMessage(raw)) {
        if (opts?.isFreeUser) {
          return {
            title: 'Concurrent session limit',
            body: 'Free tier allows one active deployment. End your current deployment first.',
            technicalDetails: technicalDetailsFrom(raw),
          }
        }
        return {
          title: 'You already have an active deployment',
          body: 'End or cancel your current deployment before starting another.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      return {
        title: 'Deployment request was not accepted',
        body: 'The cluster is busy right now. Please try again shortly.',
        technicalDetails: technicalDetailsFrom(raw),
      }
    }

    if (error.status === 422) {
      if (
        isDesignExceedsClusterCapacity({
          reason: error.reason,
          message: raw,
        })
      ) {
        return {
          title: 'Design too large for the cluster',
          body: 'This design needs more CPU or memory than the cluster provides. Reduce node sizes or remove components.',
        }
      }
      return {
        title: 'Design exceeds your resource quota',
        body: 'This design needs more CPU and memory than your plan allows. Downsize nodes, reduce replicas, or remove components before deploying.',
        technicalDetails: technicalDetailsFrom(raw),
      }
    }

    if (error.status === 400) {
      if (
        normalized.includes('app server') &&
        normalized.includes('receive traffic')
      ) {
        return {
          title: 'Add an App Server',
          body: scrubEmDashCopy(raw),
        }
      }
      if (normalized.includes('not yet available')) {
        return {
          title: 'Template not available',
          body: 'This template is not offered for live deploy yet. Simulate it if the template supports simulation.',
          technicalDetails: technicalDetailsFrom(raw),
        }
      }
      return {
        title: 'Deployment request was not accepted',
        body: 'We could not start this deployment. Please review your design and try again.',
        technicalDetails: technicalDetailsFrom(raw),
      }
    }

    if (error.status >= 500) {
      return {
        title: 'Deployment request was not accepted',
        body: 'RunCloud9 had a server error while starting deployment. Please try again.',
        technicalDetails: technicalDetailsFrom(raw),
      }
    }

    return {
      title: 'Deployment request was not accepted',
      body: 'We could not complete your request right now. Please try again.',
      technicalDetails: technicalDetailsFrom(raw),
    }
  }

  if (error instanceof TypeError) {
    return {
      title: 'Deployment request was not accepted',
      body: 'Could not reach RunCloud9 API. Check your connection and retry.',
      technicalDetails: technicalDetailsFrom(error.message),
    }
  }

  return {
    title: 'Deployment request was not accepted',
    body: 'Could not reach RunCloud9 API. Check your connection and retry.',
    technicalDetails: technicalDetailsFrom(
      error instanceof Error ? error.message : undefined,
    ),
  }
}
