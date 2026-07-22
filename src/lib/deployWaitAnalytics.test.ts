import { describe, expect, it } from 'vitest'
import { ApiError } from './apiError'
import { ResourceBudgetApiError } from './resourceBudgetError'
import {
  deployAdmitStatusFromCreate,
  deployRejectReasonFromError,
  deriveDeployWaitKind,
  readDeployQueueFields,
  shouldKeepDeployQueueFields,
} from './deployWaitAnalytics'

describe('deployWaitAnalytics', () => {
  it('derives room vs door wait kind', () => {
    expect(deriveDeployWaitKind('queued', 'waiting_for_provision_slot')).toBe(
      'room',
    )
    expect(
      deriveDeployWaitKind('provisioning', 'waiting_for_provision_slot'),
    ).toBe('door')
    expect(deriveDeployWaitKind('provisioning', 'deploying')).toBeNull()
    expect(deriveDeployWaitKind('running', undefined)).toBeNull()
  })

  it('keeps queue fields for room and door wait', () => {
    expect(shouldKeepDeployQueueFields('queued', undefined)).toBe(true)
    expect(
      shouldKeepDeployQueueFields('provisioning', 'waiting_for_provision_slot'),
    ).toBe(true)
    expect(shouldKeepDeployQueueFields('provisioning', 'deploying')).toBe(false)
  })

  it('reads queue fields without inventing defaults', () => {
    expect(
      readDeployQueueFields({
        queuePosition: 2,
        estimatedWaitSeconds: 40,
      }),
    ).toEqual({ queuePosition: 2, estimatedWaitSeconds: 40 })
    expect(readDeployQueueFields({})).toEqual({
      queuePosition: null,
      estimatedWaitSeconds: null,
    })
  })

  it('maps create admit status', () => {
    expect(deployAdmitStatusFromCreate('queued')).toBe('queued')
    expect(deployAdmitStatusFromCreate('provisioning')).toBe('provisioning')
    expect(deployAdmitStatusFromCreate('running')).toBe('provisioning')
  })

  it('maps reject reasons without leaking messages', () => {
    expect(
      deployRejectReasonFromError(
        new ResourceBudgetApiError({
          error: 'over budget',
          tier: 'explorer',
          requested: { cpu: '1', memory: '1Gi' },
          cap: { cpu: '500m', memory: '512Mi' },
          breakdown: [],
        }),
      ),
    ).toBe('resource_budget')
    expect(
      deployRejectReasonFromError(
        new ApiError(
          422,
          'this design needs more CPU or memory than the cluster provides',
          'design_exceeds_cluster_capacity',
        ),
      ),
    ).toBe('design_exceeds_cluster')
    expect(
      deployRejectReasonFromError(
        new ApiError(429, 'deploy queue is full — try again shortly'),
      ),
    ).toBe('queue_full')
    expect(
      deployRejectReasonFromError(
        new ApiError(
          429,
          'you already have an active deployment — end it before creating another',
        ),
      ),
    ).toBe('concurrent_active')
    expect(
      deployRejectReasonFromError(
        new ApiError(
          429,
          'monthly session limit reached — upgrade or wait until next month',
          'monthly_session_limit',
        ),
      ),
    ).toBe('monthly_session_limit')
    expect(
      deployRejectReasonFromError(new ApiError(422, 'design exceeds quota')),
    ).toBeUndefined()
  })
})
