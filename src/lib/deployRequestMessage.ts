import { ApiError } from './api'

export interface DeployRequestMessage {
  title: string
  body: string
  technicalDetails?: string
  actionLabel?: string
}

export function mapDeployRequestError(error: unknown): DeployRequestMessage {
  if (error instanceof ApiError) {
    const raw = error.rawMessage || error.message
    const normalized = raw.toLowerCase()

    if (error.status === 401) {
      return {
        title: 'Deployment request was not accepted',
        body: 'Please sign in to deploy infrastructure.',
        technicalDetails: raw,
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
