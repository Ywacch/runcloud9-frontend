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

  it('maps topology 403 load balancer to upgrade CTA', () => {
    const err = new ApiError(
      403,
      'load balancers require an active subscription — remove the load balancer or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Upgrade required for this topology')
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
  })

  it('maps topology 403 mq/worker to upgrade CTA', () => {
    const err = new ApiError(
      403,
      'message queues and workers require an active subscription — remove async components or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
  })

  it('maps replica limit 403 to upgrade CTA', () => {
    const err = new ApiError(
      403,
      'app server "App": replicas 2 exceed your plan limit of 1 — reduce replicas or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
  })

  it('maps proxy cache 403 to upgrade CTA', () => {
    const err = new ApiError(
      403,
      'proxy cache strategies require an active subscription — use cache-aside or timeline-store, or upgrade',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
  })

  it('maps premium template 403 to upgrade CTA', () => {
    const err = new ApiError(
      403,
      'premium templates require an active subscription',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
    expect(msg.title).toBe('Premium template')
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

  it('maps concurrent 429 for free users to upgrade CTA', () => {
    const err = new ApiError(
      429,
      'you already have an active deployment — end it before creating another',
    )
    const msg = mapDeployRequestError(err, { isFreeUser: true })
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
    expect(msg.body).toContain('concurrent')
  })

  it('maps monthly_session_limit 429 by reason with upgrade for free users', () => {
    const err = new ApiError(
      429,
      'monthly session limit reached — upgrade or wait until next month',
      'monthly_session_limit',
    )
    const msg = mapDeployRequestError(err, { isFreeUser: true })
    expect(msg.title).toBe('Out of sessions this month')
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
    expect(msg.body).toContain('Upgrade to Engineer')
    expect(msg.body).toContain('next month')
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

  it('maps chaos trial 403 to upgrade CTA', () => {
    const err = new ApiError(
      403,
      'chaos trial already used — upgrade to continue',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBe('Upgrade to Engineer')
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
