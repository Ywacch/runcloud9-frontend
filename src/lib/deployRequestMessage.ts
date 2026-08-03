import { ApiError } from './apiError'
import { isResourceBudgetApiError } from './resourceBudgetError'
import type { ResourceBudgetErrorResponse } from './sumDesignBudget'
import {
  isDesignExceedsClusterCapacity,
  isMonthlySessionLimitError,
  isQueueFullErrorMessage,
  isUserConcurrentDeployErrorMessage,
} from './deployQueue'
import {
  engineerUpgradeActionLabel,
  isChaosTrialUsedMessage,
} from './billingCopy'
import { BILLING_ENABLED } from './featureFlags'
import { scrubEmDashCopy } from './topologyRulesTypes'

export interface DeployRequestMessage {
  title: string
  body: string
  technicalDetails?: string
  actionLabel?: string
  /** Optional second CTA (e.g. switch to Explorer runnable). */
  secondaryActionLabel?: string
  resourceBudget?: ResourceBudgetErrorResponse
}

function upgradeActionLabel(): string | undefined {
  return engineerUpgradeActionLabel(BILLING_ENABLED)
}

function technicalDetailsFrom(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return scrubEmDashCopy(raw)
}

export function mapDeployRequestError(
  error: unknown,
  opts?: { isFreeUser?: boolean },
): DeployRequestMessage {
  if (isResourceBudgetApiError(error)) {
    return {
      title: 'Design exceeds your resource quota',
      body: 'This design needs more CPU and memory than your plan allows. Downsize nodes, reduce replicas, or remove components before deploying.',
      technicalDetails: technicalDetailsFrom(error.budget.error),
      resourceBudget: error.budget,
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
      if (isChaosTrialUsedMessage(raw)) {
        return {
          title: 'Chaos trial used',
          body: 'You used your free chaos trial. Upgrade to Engineer for unlimited chaos.',
          technicalDetails: technicalDetailsFrom(raw),
          actionLabel: upgradeActionLabel(),
        }
      }
      if (normalized.includes('premium')) {
        return {
          title: 'Premium template',
          body: 'This template requires RunCloud9 Engineer. Upgrade to deploy it on the cluster.',
          technicalDetails: technicalDetailsFrom(raw),
          actionLabel: upgradeActionLabel(),
        }
      }
      if (
        normalized.includes('load balancers require') ||
        normalized.includes('message queues and workers') ||
        normalized.includes('proxy cache strategies require') ||
        normalized.includes('exceed your plan limit')
      ) {
        return {
          title: 'Upgrade required for this topology',
          body: 'Engineer unlocks load balancers, queues, workers, proxy cache, and more replicas. Change the design or upgrade.',
          technicalDetails: technicalDetailsFrom(raw),
          actionLabel: upgradeActionLabel(),
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
            body: 'You hit the Explorer monthly limit. Upgrade to Engineer for more sessions, or try again next month.',
            technicalDetails: technicalDetailsFrom(raw),
            actionLabel: upgradeActionLabel(),
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
            body: 'Explorer allows one active deployment. Upgrade to Engineer for more concurrent sessions, or end your current deployment first.',
            technicalDetails: technicalDetailsFrom(raw),
            actionLabel: upgradeActionLabel(),
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
