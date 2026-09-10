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
  allowProxyCache: boolean
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

/** Matches ganymede deploy gate: TierLimits.AllTemplates for engineer/internal. */
export function canAccessPremiumTemplates(
  user: UserRecord | null,
  allTemplates = false,
): boolean {
  return allTemplates || hasPaidTier(user)
}

/** Maps effective tier to deployer quota tier names. */
export function resourceQuotaTier(effectiveTier: EffectiveTier): string {
  switch (effectiveTier) {
    case 'engineer':
      return 'engineer'
    case 'internal':
      return 'internal'
    default:
      return 'explorer'
  }
}

/** Map GET /me limits to topology guard shape. */
export function topologyLimitsFromApi(limits: {
  maxAppServerReplicas: number
  allowLoadBalancer: boolean
  allowMQWorker: boolean
  allowProxyCache: boolean
}): TopologyLimits {
  return {
    maxAppServerReplicas: limits.maxAppServerReplicas,
    allowLoadBalancer: limits.allowLoadBalancer,
    allowMQWorker: limits.allowMQWorker,
    allowProxyCache: limits.allowProxyCache,
  }
}

export type InstanceSize = 'small' | 'medium' | 'large'

export function topologyLimitsForTier(effectiveTier: EffectiveTier): TopologyLimits {
  if (effectiveTier === 'engineer' || effectiveTier === 'internal') {
    return {
      maxAppServerReplicas: 3,
      allowLoadBalancer: true,
      allowMQWorker: true,
      allowProxyCache: true,
    }
  }
  return {
    maxAppServerReplicas: 3,
    allowLoadBalancer: true,
    allowMQWorker: true,
    allowProxyCache: true,
  }
}

export function maxInstanceSizeForUser(
  user: UserRecord | null,
  apiLimits?: { maxInstanceSize?: string } | null,
): InstanceSize {
  const fromApi = String(apiLimits?.maxInstanceSize ?? '').trim().toLowerCase()
  if (fromApi === 'small' || fromApi === 'medium' || fromApi === 'large') {
    return fromApi
  }
  return hasPaidTier(user) ? 'large' : 'medium'
}

export function isInstanceSizePlanLocked(
  size: string,
  maxSize: InstanceSize,
): boolean {
  const normalized = String(size).trim().toLowerCase()
  if (normalized !== 'large') return false
  return maxSize !== 'large'
}

export function maxAppServerReplicasForUser(user: UserRecord | null): number {
  return topologyLimitsForTier(resolveEffectiveTier(user)).maxAppServerReplicas
}

/** Default live loadgen RPS ceiling for Explorer / Engineer tiers. */
export const LOADGEN_RPS_CAP_DEFAULT = 500

/** Internal accounts can run higher load for capacity testing. */
export const LOADGEN_RPS_CAP_INTERNAL = 2000

export function maxLoadgenRpsForUser(user: UserRecord | null): number {
  return resolveEffectiveTier(user) === 'internal'
    ? LOADGEN_RPS_CAP_INTERNAL
    : LOADGEN_RPS_CAP_DEFAULT
}

export function clampLoadgenRps(rps: number, user: UserRecord | null): number {
  const max = maxLoadgenRpsForUser(user)
  const n = Math.floor(Number(rps))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(max, n)
}
