import { HALF_H, HALF_W } from '../math/iso'
import type { BrandTint } from '../skins/engineSkins'
import { EngineBadge } from './EngineBadge'
import type { PointerEvent as ReactPointerEvent } from 'react'

type LoadBalancerGlyphProps = {
  x: number
  y: number
  label: string
  tint: BrandTint
  logoId: string | null
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

/** Hex-prism load balancer (singleton — no replica stack). */
export function LoadBalancerGlyph({
  x,
  y,
  label,
  tint,
  logoId,
  selected = false,
  interactive = false,
  onPointerDown,
}: LoadBalancerGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  const topPts = [
    [HALF_W * 0.3, -HALF_H * 0.2],
    [HALF_W, -HALF_H * 0.7],
    [HALF_W * 1.7, -HALF_H * 0.2],
    [HALF_W * 1.7, HALF_H * 0.3],
    [HALF_W, HALF_H * 0.8],
    [HALF_W * 0.3, HALF_H * 0.3],
  ]
    .map((p) => p.join(' '))
    .join(' ')
  const h = 32

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="load-balancer"
    >
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
      >
        <polygon
          points={`${HALF_W * 0.3} ${HALF_H * 0.3} ${HALF_W} ${HALF_H * 0.8} ${HALF_W} ${HALF_H * 0.8 + h} ${HALF_W * 0.3} ${HALF_H * 0.3 + h}`}
          fill={tint.left}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={`${HALF_W * 1.7} ${HALF_H * 0.3} ${HALF_W} ${HALF_H * 0.8} ${HALF_W} ${HALF_H * 0.8 + h} ${HALF_W * 1.7} ${HALF_H * 0.3 + h}`}
          fill={tint.right}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={topPts}
          fill={tint.top}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <EngineBadge cx={HALF_W} cy={0} logoId={logoId} letter={label} />
      </g>
    </g>
  )
}
