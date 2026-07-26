import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import { healthRimStyle } from '../../canvas/utils/healthVisual'
import { rimCssColor } from './healthRimCss'

/** Shared SVG filter ids mounted once by `HealthRimFilters`. */
export const HEALTH_RIM_FILTER_IDS = {
  healthy: 'svg-health-rim-healthy',
  warning: 'svg-health-rim-warning',
  error: 'svg-health-rim-error',
  chaos: 'svg-health-rim-chaos',
} as const

export type HealthRimFilterKey = keyof typeof HEALTH_RIM_FILTER_IDS

/** Resolve shared outline filter id for a live health visual, or null when off. */
export function healthRimFilterId(
  healthVisual: HealthVisualState | undefined,
): string | null {
  const style = healthRimStyle(healthVisual ?? 'off')
  if (!style || !healthVisual || healthVisual === 'off' || healthVisual === 'idle') {
    return null
  }
  if (healthVisual === 'chaos') return HEALTH_RIM_FILTER_IDS.chaos
  if (healthVisual === 'healthy') return HEALTH_RIM_FILTER_IDS.healthy
  if (healthVisual === 'warning') return HEALTH_RIM_FILTER_IDS.warning
  if (healthVisual === 'error') return HEALTH_RIM_FILTER_IDS.error
  return null
}

/** Flood colors for shared filter defs (matches Pixi rim palette). */
export function healthRimFloodColor(key: HealthRimFilterKey): string {
  if (key === 'chaos') return rimCssColor(0xa78bfa)
  if (key === 'healthy') return rimCssColor(0x22c55e)
  if (key === 'warning') return rimCssColor(0xf59e0b)
  return rimCssColor(0xef4444)
}

/**
 * SVG host pulse floor — slightly higher than Pixi base so the silhouette
 * reads on light floors and same-colored glyphs.
 */
export function healthRimLayerOpacity(pulseAlpha: number): number {
  return Math.min(1, Math.max(0.55, pulseAlpha + 0.35))
}
