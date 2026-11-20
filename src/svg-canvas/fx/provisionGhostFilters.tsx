export const PROVISION_GHOST_FILTER_IDS = {
  pending: 'cv-provision-ghost-pending',
  building: 'cv-provision-ghost-building',
} as const

/** Desaturate the painted glyph, including Redis brand fills and health rims. */
export function ProvisionGhostFilters() {
  return (
    <defs>
      <filter
        id={PROVISION_GHOST_FILTER_IDS.pending}
        colorInterpolationFilters="sRGB"
      >
        <feColorMatrix type="saturate" values="0.1" />
      </filter>
      <filter
        id={PROVISION_GHOST_FILTER_IDS.building}
        colorInterpolationFilters="sRGB"
      >
        <feColorMatrix type="saturate" values="0.28" />
      </filter>
    </defs>
  )
}

export function provisionGhostFilterUrl(
  phase: 'off' | 'pending' | 'building' | 'ready',
): string | undefined {
  if (phase === 'pending') return `url(#${PROVISION_GHOST_FILTER_IDS.pending})`
  if (phase === 'building') return `url(#${PROVISION_GHOST_FILTER_IDS.building})`
  return undefined
}
