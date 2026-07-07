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

  it('keeps premium template 403 distinct from topology', () => {
    const err = new ApiError(403, 'premium template required')
    const msg = mapDeployRequestError(err)
    expect(msg.actionLabel).toBeUndefined()
    expect(msg.body).toContain('Premium')
  })
})
