import { ApiError } from './apiError'
import { isResourceBudgetApiError } from './resourceBudgetError'
import type { ResourceBudgetErrorResponse } from './sumDesignBudget'

export interface DeployRequestMessage {
  title: string
  body: string
  technicalDetails?: string
  actionLabel?: string
  resourceBudget?: ResourceBudgetErrorResponse
}

export function mapDeployRequestError(error: unknown): DeployRequestMessage {
  if (isResourceBudgetApiError(error)) {
    return {
      title: 'Design exceeds your resource quota',
      body: 'This design needs more CPU and memory than your plan allows. Downsize nodes, reduce replicas, or remove components before deploying.',
      technicalDetails: error.budget.error,
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
      if (normalized.includes('premium')) {
        return {
          title: 'Deployment request was not accepted',
          body: 'This template requires RunCloud9 Premium.',
          technicalDetails: raw,
        }
      }
      if (
        normalized.includes('load balancers require') ||
        normalized.includes('message queues and workers') ||
        normalized.includes('exceed your plan limit')
      ) {
        return {
          title: 'Upgrade required for this topology',
          body: 'Load balancing, async components (message queue + worker), and multiple app replicas are available on the Engineer plan. Remove those components or upgrade to deploy this design.',
          technicalDetails: raw,
          actionLabel: 'Upgrade to Engineer',
        }
      }
      if (normalized.includes('you do not own this deployment')) {
        return {
          title: 'Deployment request was not accepted',
          body: 'You do not have access to this deployment.',
          technicalDetails: raw,
        }
      }
      return {
        title: 'Deployment request was not accepted',
        body: 'You do not have permission to perform this action.',
        technicalDetails: raw,
      }
    }

    if (error.status === 422) {
      return {
        title: 'Design exceeds your resource quota',
        body: 'This design needs more CPU and memory than your plan allows. Downsize nodes, reduce replicas, or remove components before deploying.',
        technicalDetails: raw,
      }
    }

    if (error.status === 400) {
      return {
        title: 'Deployment request was not accepted',
        body: 'We could not start this deployment. Please review your design and try again.',
        technicalDetails: raw,
      }
    }

    if (error.status >= 500) {
      return {
        title: 'Deployment request was not accepted',
        body: 'RunCloud9 had a server error while starting deployment. Please try again.',
        technicalDetails: raw,
      }
    }

    return {
      title: 'Deployment request was not accepted',
      body: 'We could not complete your request right now. Please try again.',
      technicalDetails: raw,
    }
  }

  if (error instanceof TypeError) {
    return {
      title: 'Deployment request was not accepted',
      body: 'Could not reach RunCloud9 API. Check your connection and retry.',
      technicalDetails: error.message,
    }
  }

  return {
    title: 'Deployment request was not accepted',
    body: 'Could not reach RunCloud9 API. Check your connection and retry.',
    technicalDetails: error instanceof Error ? error.message : undefined,
  }
}
