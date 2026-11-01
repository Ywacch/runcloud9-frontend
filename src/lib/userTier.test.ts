import { describe, expect, it } from 'vitest'
import {
  canAccessPremiumTemplates,
  clampLoadgenRps,
  clampLoadgenRpsToMax,
  hasPaidTier,
  maxLoadgenRpsForUser,
  resolveEffectiveTier,
  resourceQuotaTier,
  topologyLimitsForTier,
  maxInstanceSizeForUser,
  quotaTierFromAuth,
} from './userTier'

describe('userTier', () => {
  it('treats missing user as free', () => {
    expect(resolveEffectiveTier(null)).toBe('free')
    expect(hasPaidTier(null)).toBe(false)
    expect(resourceQuotaTier('free')).toBe('explorer')
  })

  it('does not assume Free canvas quota while a session is hydrating', () => {
    expect(quotaTierFromAuth(null, null, true)).toBeUndefined()
    expect(quotaTierFromAuth(null, null, false)).toBe('explorer')
    expect(
      quotaTierFromAuth(
        { quotaTier: 'internal', effectiveTier: 'internal' },
        { isInternal: true, isPremium: false, premiumExpiresAt: null },
        true,
      ),
    ).toBe('internal')
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
    expect(topologyLimitsForTier('internal').allowAutoscale).toBe(true)
    expect(topologyLimitsForTier('engineer').allowAutoscale).toBe(false)
    expect(topologyLimitsForTier('free').allowAutoscale).toBe(false)
  })

  it('maps engineer to engineer quota', () => {
    expect(resourceQuotaTier('engineer')).toBe('engineer')
  })

  it('free tier allows full topology and caps replicas at 5', () => {
    const limits = topologyLimitsForTier('free')
    expect(limits.allowLoadBalancer).toBe(true)
    expect(limits.allowMQWorker).toBe(true)
    expect(limits.allowProxyCache).toBe(true)
    expect(limits.maxAppServerReplicas).toBe(5)
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

  it('clampLoadgenRpsToMax clamps to a numeric ceiling', () => {
    expect(clampLoadgenRpsToMax(1750, 2000)).toBe(1750)
    expect(clampLoadgenRpsToMax(2500, 2000)).toBe(2000)
    expect(clampLoadgenRpsToMax(0, 500)).toBe(1)
  })

  it('caps loadgen RPS by effective tier', () => {
    const internal = {
      isInternal: true,
      isPremium: false,
      premiumExpiresAt: null,
    }
    const engineer = {
      isInternal: false,
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }
    expect(maxLoadgenRpsForUser(internal)).toBe(2000)
    expect(clampLoadgenRps(1750, internal)).toBe(1750)
    expect(clampLoadgenRps(2500, internal)).toBe(2000)
    expect(maxLoadgenRpsForUser(engineer)).toBe(1000)
    expect(clampLoadgenRps(750, engineer)).toBe(750)
    expect(clampLoadgenRps(1500, engineer)).toBe(1000)
    expect(maxLoadgenRpsForUser(null)).toBe(500)
  })

  it('prefers maxLoadgenRps from GET /me limits', () => {
    expect(
      maxLoadgenRpsForUser(
        {
          isInternal: false,
          isPremium: true,
          premiumExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
        { maxLoadgenRps: 750 },
      ),
    ).toBe(750)
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
