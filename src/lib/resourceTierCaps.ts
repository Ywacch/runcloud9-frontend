/** Subscription tier CPU/memory caps — mirrors deployer.TierResourceCaps. */
export const DEFAULT_RESOURCE_TIER = 'explorer'

export const TIER_RESOURCE_CAPS: Record<string, { cpu: string; memory: string }> =
  {
    explorer: { cpu: '1075m', memory: '2048Mi' },
    engineer: { cpu: '3375m', memory: '6912Mi' },
    internal: { cpu: '4250m', memory: '8320Mi' },
    architect: { cpu: '4', memory: '8Gi' },
  }

export function normalizeResourceTier(tier: string | undefined | null): string {
  const normalized = String(tier ?? '')
    .trim()
    .toLowerCase()
  if (normalized in TIER_RESOURCE_CAPS) return normalized
  return DEFAULT_RESOURCE_TIER
}

export function tierResourceCaps(tier: string | undefined | null): {
  cpu: string
  memory: string
} {
  return TIER_RESOURCE_CAPS[normalizeResourceTier(tier)]
}

/** Loadgen pod limits included in user-facing budget totals. */
export function loadgenLimits(tier: string | undefined | null): {
  cpu: string
  memory: string
} {
  const normalized = normalizeResourceTier(tier)
  switch (normalized) {
    case 'internal':
    case 'architect':
      return { cpu: '1000m', memory: '1Gi' }
    case 'engineer':
      return { cpu: '500m', memory: '512Mi' }
    default:
      return { cpu: '250m', memory: '256Mi' }
  }
}
