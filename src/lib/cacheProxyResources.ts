import type { ResourceLimitsJSON } from './deploymentTypes'

/** Allowed proxy size names — same labels as Redis, different CPU/RAM amounts. */
export const PROXY_INSTANCE_SIZES = ['small', 'medium', 'large'] as const
export type ProxyInstanceSize = (typeof PROXY_INSTANCE_SIZES)[number]

/**
 * Mirrors ganymede deployer.proxyResourcesForProfile.
 * Amounts differ from Redis ResourceProfile (proxy sized for HTTP+DB work).
 */
export const PROXY_RESOURCE_PROFILES: Record<ProxyInstanceSize, ResourceLimitsJSON> = {
  small: { cpu: '250m', memory: '512Mi', ephemeralStorage: '100Mi' },
  medium: { cpu: '500m', memory: '1Gi', ephemeralStorage: '200Mi' },
  large: { cpu: '750m', memory: '1536Mi', ephemeralStorage: '200Mi' },
}

/** Canvas Redis size: instanceSize, else resourceProfile, else small. */
export function redisProfileFromConfig(config: Record<string, unknown>): string {
  const fromInstance = String(config.instanceSize ?? '').trim()
  if (fromInstance) return fromInstance
  const fromProfile = String(config.resourceProfile ?? '').trim()
  if (fromProfile) return fromProfile
  return 'small'
}

/**
 * Mirrors ganymede deployer.DefaultProxyResourceProfile /
 * defaultProxyProfileForRedis — used when proxyInstanceSize is unset.
 */
export function defaultProxyResourceProfile(redisProfile: string): ProxyInstanceSize {
  switch (String(redisProfile ?? '').trim().toLowerCase()) {
    case 'large':
      return 'large'
    case 'medium':
      return 'medium'
    default:
      return 'small'
  }
}

export function normalizeProxyInstanceSize(raw: unknown): ProxyInstanceSize {
  const p = String(raw ?? '')
    .trim()
    .toLowerCase()
  if ((PROXY_INSTANCE_SIZES as readonly string[]).includes(p)) {
    return p as ProxyInstanceSize
  }
  return 'small'
}

/**
 * Effective proxy size for UI / budget: explicit proxyInstanceSize or
 * proxyResourceProfile, else default from Redis size.
 */
export function resolveProxyInstanceSize(
  config: Record<string, unknown>,
): ProxyInstanceSize {
  const fromInstance = String(config.proxyInstanceSize ?? '').trim()
  if (fromInstance) return normalizeProxyInstanceSize(fromInstance)
  const fromProfile = String(config.proxyResourceProfile ?? '').trim()
  if (fromProfile) return normalizeProxyInstanceSize(fromProfile)
  return defaultProxyResourceProfile(redisProfileFromConfig(config))
}

/** Mirrors ganymede deployer.CacheProxyResources. */
export function resolveProxyProvisionedLimits(
  config: Record<string, unknown>,
): ResourceLimitsJSON {
  return PROXY_RESOURCE_PROFILES[resolveProxyInstanceSize(config)]
}
