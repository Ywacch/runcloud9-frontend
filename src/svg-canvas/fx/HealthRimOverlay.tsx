import type { WorldPoint } from '../math/iso'
import { inflatePoints, pointsToAttr } from './glyphHealthRim'

type HealthRimOverlayProps = {
  points: WorldPoint[]
  color: string
  alpha: number
}

/**
 * Dual-stroke silhouette rim — crisp inner + soft outer glow.
 * Same inflate amounts as Pixi `ComponentContainer._drawHealthOverlay`.
 */
export function HealthRimOverlay({ points, color, alpha }: HealthRimOverlayProps) {
  if (points.length < 3) return null
  const crisp = pointsToAttr(inflatePoints(points, 4))
  const soft = pointsToAttr(inflatePoints(points, 6))
  return (
    <g data-health-rim style={{ pointerEvents: 'none' }}>
      <polygon
        points={soft}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinejoin="round"
        opacity={alpha * 0.25}
      />
      <polygon
        points={crisp}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        opacity={alpha}
      />
    </g>
  )
}
