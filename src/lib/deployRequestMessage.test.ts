import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiError'

vi.mock('./featureFlags', () => ({
  BILLING_ENABLED: true,
}))

import { mapDeployRequestError } from './deployRequestMessage'

describe('mapDeployRequestError', () => {
  it('omits upgrade CTA when billing is disabled', async () => {
    vi.resetModules()
    vi.doMock('./featureFlags', () => ({ BILLING_ENABLED: false }))
    const { mapDeployRequestError: mapOff } = await import('./deployRequestMessage')
    const err = new ApiError(
      403,
      'premium templates require an active subscription',
    )
    expect(mapOff(err).actionLabel).toBeUndefined()
  })

  it('maps topology 403 load balancer without upgrade CTA', () => {
    const err = new ApiError(
      403,
      'load balancers require an active subscription — remove the load balancer or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Design not supported on your plan')
    expect(msg.actionLabel).toBeUndefined()
  })

  it('maps topology 403 mq/worker without upgrade CTA', () => {
    const err = new ApiError(
      403,
      'message queues and workers require an active subscription — remove async components or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
  })

  it('maps replica limit 403 without upgrade CTA', () => {
    const err = new ApiError(
      403,
      'app server "App": replicas 2 exceed your plan limit of 1 — reduce replicas or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
  })

  it('maps proxy cache 403 without upgrade CTA', () => {
    const err = new ApiError(
      403,
      'proxy cache strategies require an active subscription — use cache-aside or timeline-store, or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
  })

  it('maps premium template 403 without upgrade CTA', () => {
    const err = new ApiError(
      403,
      'premium templates require an active subscription',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.title).toBe('Template not available')
  })

  it('maps 401 to session expired with sign-in CTA', () => {
    const err = new ApiError(401, 'invalid token')
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Session expired')
    expect(msg.actionLabel).toBe('Sign in')
  })

  it('maps failed to load user 500 as session expired', () => {
    const err = new ApiError(500, 'failed to load user')
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Session expired')
    expect(msg.body).toContain('sign in again')
    expect(msg.actionLabel).toBe('Sign in')
  })

  it('maps email_unconfirmed 403 without sign-in CTA', () => {
    const err = new ApiError(
      403,
      'confirm your email before deploying',
      'email_unconfirmed',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Confirm your email')
    expect(msg.body).toContain('Confirm your email before deploying')
    expect(msg.actionLabel).toBeUndefined()
  })

  it('maps queue_full 429 to cluster queue copy', () => {
    const err = new ApiError(429, 'deploy queue is full — try again shortly')
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Cluster queue is full')
    expect(msg.body).toContain('try again in a minute')
    expect(msg.body).not.toContain('active deployment')
  })

  it('maps per-user concurrent 429 for paid users without upgrade CTA', () => {
    const err = new ApiError(
      429,
      'you already have an active deployment — end it before creating another',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('You already have an active deployment')
    expect(msg.actionLabel).toBeUndefined()
  })

  it('maps concurrent 429 for free users without upgrade CTA', () => {
    const err = new ApiError(
      429,
      'you already have an active deployment — end it before creating another',
    )
    const msg = mapDeployRequestError(err, { isFreeUser: true })
    expect(msg.title).toBe('Concurrent session limit')
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.body).toContain('one active deployment')
  })

  it('maps monthly_session_limit 429 by reason without upgrade for free users', () => {
    const err = new ApiError(
      429,
      'monthly session limit reached — upgrade or wait until next month',
      'monthly_session_limit',
    )
    const msg = mapDeployRequestError(err, { isFreeUser: true })
    expect(msg.title).toBe('Out of sessions this month')
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.body).toContain('next month')
    expect(msg.body).not.toContain('Upgrade')
  })

  it('maps monthly_session_limit 429 without upgrade for paid users', () => {
    const err = new ApiError(
      429,
      'monthly session limit reached — upgrade or wait until next month',
      'monthly_session_limit',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Out of sessions this month')
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.body).toContain('Try again next month')
    expect(msg.body).not.toContain('Upgrade')
  })

  it('keeps concurrent 429 distinct from monthly session limit', () => {
    const err = new ApiError(
      429,
      'you already have an active deployment — end it before creating another',
    )
    const msg = mapDeployRequestError(err, { isFreeUser: true })
    expect(msg.title).toBe('Concurrent session limit')
    expect(msg.body).not.toContain('this month')
  })

  it('maps chaos trial 403 without upgrade CTA', () => {
    const err = new ApiError(
      403,
      'chaos trial already used — upgrade to continue',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.title).toBe('Chaos trial used')
    expect(msg.technicalDetails).not.toContain('—')
    expect(msg.technicalDetails).toMatch(/upgrade to continue/i)
  })

  it('maps design_exceeds_cluster_capacity 422 by reason', () => {
    const err = new ApiError(
      422,
      'this design needs more CPU or memory than the cluster provides',
      'design_exceeds_cluster_capacity',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Design too large for the cluster')
    expect(msg.body).toContain('Reduce node sizes or remove components')
    expect(msg.technicalDetails).toBeUndefined()
    expect(msg.resourceBudget).toBeUndefined()
  })

  it('maps design_exceeds_cluster_capacity 422 by message fallback', () => {
    const err = new ApiError(
      422,
      'this design needs more CPU or memory than the cluster provides',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Design too large for the cluster')
  })

  it('keeps generic 422 as plan quota when not cluster-capacity', () => {
    const err = new ApiError(422, 'design exceeds quota')
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Design exceeds your resource quota')
  })

  it('maps template not yet available 400 to clear title', () => {
    const err = new ApiError(400, 'template "ticket-drop" is not yet available')
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Template not available')
    expect(msg.body).toContain('not offered for live deploy')
    expect(msg.technicalDetails).toContain('ticket-drop')
  })

  it('maps missing app-server 400 to clear title', () => {
    const err = new ApiError(
      400,
      'Add an App Server — live sessions need something to receive traffic',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Add an App Server')
    expect(msg.body).toMatch(/receive traffic/i)
    expect(msg.body).not.toContain('—')
  })
})
