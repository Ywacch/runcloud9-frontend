import { useEffect, useState } from 'react'
import {
  healthRimAlpha,
  healthRimStyle,
  type HealthRimStyle,
  type HealthVisualState,
} from '../../canvas/utils/healthVisual'

/** Pixi `0xRRGGBB` → CSS `#rrggbb`. */
export function rimCssColor(hex: number): string {
  return `#${(hex >>> 0).toString(16).padStart(6, '0')}`
}

export function resolveRimStyle(
  healthVisual: HealthVisualState | undefined,
): HealthRimStyle | null {
  return healthRimStyle(healthVisual ?? 'off')
}

/** RAF-driven pulse alpha for warning / error / chaos rims. */
export function usePulsingAlpha(style: HealthRimStyle | null): number {
  const [alpha, setAlpha] = useState(() =>
    style ? healthRimAlpha(style, 0) : 0,
  )

  useEffect(() => {
    if (!style) {
      setAlpha(0)
      return
    }
    if (style.pulseSpeed === 0) {
      setAlpha(style.baseAlpha)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsedSec = (now - start) / 1000
      setAlpha(healthRimAlpha(style, elapsedSec))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [style])

  return alpha
}
