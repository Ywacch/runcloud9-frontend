import { describe, expect, it } from 'vitest'
import {
  hasPaidTier,
  resolveEffectiveTier,
  resourceQuotaTier,
  topologyLimitsForTier,
} from './userTier'

describe('userTier', () => {
  it('treats missing user as free', () => {
    expect(resolveEffectiveTier(null)).toBe('free')
    expect(hasPaidTier(null)).toBe(false)
    expect(resourceQuotaTier('free')).toBe('explorer')
  })

  it('requires premium expiry in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(
      resolveEffectiveTier({
        isInternal: false,
        isPremium: true,
        premiumExpiresAt: future,
      }),
    ).toBe('engineer')
    expect(
      resolveEffectiveTier({
        isInternal: false,
        isPremium: true,
        premiumExpiresAt: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe('free')
    expect(
      resolveEffectiveTier({
        isInternal: false,
        isPremium: true,
        premiumExpiresAt: null,
      }),
    ).toBe('free')
  })

  it('maps internal to engineer quota and full topology', () => {
    expect(
      resolveEffectiveTier({
        isInternal: true,
        isPremium: false,
        premiumExpiresAt: null,
      }),
    ).toBe('internal')
    expect(resourceQuotaTier('internal')).toBe('engineer')
    expect(topologyLimitsForTier('internal').allowLoadBalancer).toBe(true)
  })

  it('free tier blocks lb/mq/worker and caps replicas at 1', () => {
    const limits = topologyLimitsForTier('free')
    expect(limits.allowLoadBalancer).toBe(false)
    expect(limits.allowMQWorker).toBe(false)
    expect(limits.maxAppServerReplicas).toBe(1)
  })
})
