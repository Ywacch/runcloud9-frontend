import { describe, expect, it } from 'vitest'
import {
  canAccessPremiumTemplates,
  hasPaidTier,
  resolveEffectiveTier,
  resourceQuotaTier,
  topologyLimitsForTier,
  maxInstanceSizeForUser,
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

  it('maps internal to internal quota and full topology', () => {
    expect(
      resolveEffectiveTier({
        isInternal: true,
        isPremium: false,
        premiumExpiresAt: null,
      }),
    ).toBe('internal')
    expect(resourceQuotaTier('internal')).toBe('internal')
    expect(topologyLimitsForTier('internal').allowLoadBalancer).toBe(true)
  })

  it('maps engineer to engineer quota', () => {
    expect(resourceQuotaTier('engineer')).toBe('engineer')
  })

  it('free tier allows full topology and caps replicas at 3', () => {
    const limits = topologyLimitsForTier('free')
    expect(limits.allowLoadBalancer).toBe(true)
    expect(limits.allowMQWorker).toBe(true)
    expect(limits.allowProxyCache).toBe(true)
    expect(limits.maxAppServerReplicas).toBe(3)
  })

  it('maxInstanceSizeForUser uses API limits when present', () => {
    expect(
      maxInstanceSizeForUser(null, { maxInstanceSize: 'medium' }),
    ).toBe('medium')
    expect(
      maxInstanceSizeForUser(
        { isInternal: false, isPremium: false, premiumExpiresAt: null },
        { maxInstanceSize: 'large' },
      ),
    ).toBe('large')
  })

  it('engineer tier allows proxy cache strategies', () => {
    expect(topologyLimitsForTier('engineer').allowProxyCache).toBe(true)
  })

  it('canAccessPremiumTemplates follows allTemplates and paid tier', () => {
    expect(canAccessPremiumTemplates(null, false)).toBe(false)
    expect(canAccessPremiumTemplates(null, true)).toBe(true)
    expect(
      canAccessPremiumTemplates(
        {
          isInternal: true,
          isPremium: false,
          premiumExpiresAt: null,
        },
        false,
      ),
    ).toBe(true)
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(
      canAccessPremiumTemplates(
        {
          isInternal: false,
          isPremium: true,
          premiumExpiresAt: future,
        },
        false,
      ),
    ).toBe(true)
    expect(
      canAccessPremiumTemplates(
        {
          isInternal: false,
          isPremium: true,
          premiumExpiresAt: future,
        },
        true,
      ),
    ).toBe(true)
  })
})
