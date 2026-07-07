/** Mirrors ganymede/pkg/store user tier resolution. */

export type EffectiveTier = 'free' | 'engineer' | 'internal'

export interface UserRecord {
  isInternal: boolean
  isPremium: boolean
  premiumExpiresAt: string | null
}

export interface TopologyLimits {
  maxAppServerReplicas: number
  allowLoadBalancer: boolean
  allowMQWorker: boolean
}

export function resolveEffectiveTier(user: UserRecord | null): EffectiveTier {
  if (!user) return 'free'
  if (user.isInternal) return 'internal'
  if (user.isPremium && user.premiumExpiresAt) {
    const expires = Date.parse(user.premiumExpiresAt)
    if (Number.isFinite(expires) && Date.now() < expires) {
      return 'engineer'
    }
  }
  return 'free'
}

export function hasPaidTier(user: UserRecord | null): boolean {
  return resolveEffectiveTier(user) !== 'free'
}

/** Maps effective tier to deployer quota tier names. */
export function resourceQuotaTier(effectiveTier: EffectiveTier): string {
  return effectiveTier === 'engineer' || effectiveTier === 'internal'
    ? 'engineer'
    : 'explorer'
}

export function topologyLimitsForTier(effectiveTier: EffectiveTier): TopologyLimits {
  if (effectiveTier === 'engineer' || effectiveTier === 'internal') {
    return {
      maxAppServerReplicas: 3,
      allowLoadBalancer: true,
      allowMQWorker: true,
    }
  }
  return {
    maxAppServerReplicas: 1,
    allowLoadBalancer: false,
    allowMQWorker: false,
  }
}

export function maxAppServerReplicasForUser(user: UserRecord | null): number {
  return topologyLimitsForTier(resolveEffectiveTier(user)).maxAppServerReplicas
}
