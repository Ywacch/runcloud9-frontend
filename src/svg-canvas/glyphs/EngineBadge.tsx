import { HALF_W, HALF_H } from '../math/iso'
import { IsoFaceLogo } from './IsoFaceLogo'

type EngineBadgeProps = {
  cx: number
  cy: number
  size?: number
  logoId: string | null
  /** @deprecated Unused — letter chips removed; kept for call-site compat. */
  letter?: string
  leftFace?: { cx: number; cy: number; width: number; height: number } | null
}

/**
 * Engine mark seated on the isometric top face (and optional left wall).
 * No letter-chip fallback — missing logoId renders nothing.
 */
export function EngineBadge({
  cx,
  cy,
  size = 56,
  logoId,
  leftFace = null,
}: EngineBadgeProps) {
  return (
    <IsoFaceLogo
      cx={cx}
      cy={cy}
      size={size}
      shape="diamond"
      logoId={logoId}
      leftFace={leftFace}
    />
  )
}

/** Default badge seat: center of an iso top face from left tip. */
export const TOP_FACE_CENTER = { x: HALF_W, y: 0 }
export const BADGE_Y = -HALF_H * 0.15
