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

/**
 * Canvas quota tier for UI gates.
 * Undefined when a session exists but GET /me has not loaded — do not assume explorer/Free.
 */
export function quotaTierFromAuth(
  currentUser: {
    quotaTier?: string | null
    effectiveTier?: string | null
  } | null,
  userRecord: UserRecord | null,
  hasSession: boolean,
): string | undefined {
  const quota = String(currentUser?.quotaTier ?? '').trim()
  if (quota) return quota
  const effective = currentUser?.effectiveTier
  if (
    effective === 'free' ||
    effective === 'engineer' ||
    effective === 'internal'
  ) {
    return resourceQuotaTier(effective)
  }
  if (userRecord) return resourceQuotaTier(resolveEffectiveTier(userRecord))
  if (!hasSession) return resourceQuotaTier('free')
  return undefined
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

/** Free / explorer live loadgen RPS ceiling. */
export const LOADGEN_RPS_CAP_DEFAULT = 500

/** Cloud9 engineer tier live loadgen RPS ceiling. */
export const LOADGEN_RPS_CAP_ENGINEER = 1000

/** Internal accounts can run higher load for capacity testing. */
export const LOADGEN_RPS_CAP_INTERNAL = 2000

export function maxLoadgenRpsForUser(
  user: UserRecord | null,
  apiLimits?: { maxLoadgenRps?: number } | null,
): number {
  const fromApi = apiLimits?.maxLoadgenRps
  if (typeof fromApi === 'number' && Number.isFinite(fromApi) && fromApi >= 1) {
    return Math.floor(fromApi)
  }
  switch (resolveEffectiveTier(user)) {
    case 'internal':
      return LOADGEN_RPS_CAP_INTERNAL
    case 'engineer':
      return LOADGEN_RPS_CAP_ENGINEER
    default:
      return LOADGEN_RPS_CAP_DEFAULT
  }
}

export function clampLoadgenRpsToMax(rps: number, max: number): number {
  const n = Math.floor(Number(rps))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(max, n)
}

export function clampLoadgenRps(rps: number, user: UserRecord | null): number {
  return clampLoadgenRpsToMax(rps, maxLoadgenRpsForUser(user))
}
