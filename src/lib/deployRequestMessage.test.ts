import { describe, expect, it } from 'vitest'
import { ApiError } from './apiError'
import { mapDeployRequestError } from './deployRequestMessage'

describe('mapDeployRequestError', () => {
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

  it('keeps premium template 403 distinct from topology', () => {
    const err = new ApiError(403, 'premium template required')
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.body).toContain('Premium')
  })

  it('maps queue_full 429 to cluster queue copy', () => {
    const err = new ApiError(429, 'deploy queue is full — try again shortly')
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('Cluster queue is full')
    expect(msg.body).toContain('try again in a minute')
    expect(msg.body).not.toContain('active deployment')
  })

  it('maps per-user concurrent 429 distinctly from queue_full', () => {
    const err = new ApiError(
      429,
      'you already have an active deployment — end it before creating another',
    )
    const msg = mapDeployRequestError(err)
    expect(msg.title).toBe('You already have an active deployment')
    expect(msg.title).not.toBe('Cluster queue is full')
  })
})
