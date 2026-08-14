import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import {
  CC_HALF_H,
  CC_HALF_W,
  CC_REDIS_SIDE_H,
  composeRedisBrandSlabs,
} from '../compose/cloudcraftRedisBrand'
import type { MotionUnit } from '../store/unitMotionStore'
import { compareUnitPaintOrder } from '../compose/composePacking'
import {
  resolveRimStyle,
  usePulsingAlpha,
} from '../fx/healthRimCss'
import {
  healthRimFilterId,
  healthRimLayerOpacity,
} from '../fx/healthRimFilter'
import { RedisFaceMarks } from './RedisFaceMarks'
import type { PointerEvent as ReactPointerEvent } from 'react'

type RedisBrandGlyphProps = {
  x: number
  y: number
  units?: MotionUnit[]
  selected?: boolean
  healthVisual?: HealthVisualState
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerLeave?: (e: ReactPointerEvent<SVGGElement>) => void
}

function RedisSlabs({
  stroke,
  strokeWidth,
}: {
  stroke: string
  strokeWidth: number
}) {
  const hw = CC_HALF_W
  const hh = CC_HALF_H
  const side = CC_REDIS_SIDE_H
  const slabs = composeRedisBrandSlabs()
  return (
    <g>
      {slabs.map((s, i) => {
        const y = s.dy
        const left = `0 ${y} ${hw} ${y + hh} ${hw} ${y + hh + side} 0 ${y + side}`
        const right = `${hw * 2} ${y} ${hw} ${y + hh} ${hw} ${y + hh + side} ${hw * 2} ${y + side}`
        const top = `0 ${y} ${hw} ${y - hh} ${hw * 2} ${y} ${hw} ${y + hh}`
        const fills =
          i === slabs.length - 1
            ? { top: '#d82f27', left: '#ad261f', right: '#821c17' }
            : i === 1
              ? { top: '#c42a23', left: '#9a221c', right: '#751913' }
              : { top: '#a8241e', left: '#851c18', right: '#641410' }
        return (
          <g key={i}>
            <polygon points={left} fill={fills.left} stroke={stroke} strokeWidth={strokeWidth} />
            <polygon points={right} fill={fills.right} stroke={stroke} strokeWidth={strokeWidth} />
            <polygon points={top} fill={fills.top} stroke={stroke} strokeWidth={strokeWidth} />
          </g>
        )
      })}
    </g>
  )
}

function RedisMark({
  stroke,
  strokeWidth,
  rimFilter,
  rimOpacity,
}: {
  stroke: string
  strokeWidth: number
  rimFilter: string | null
  rimOpacity: number
}) {
  // Anchor = left tip of bottom slab top face at (0,0) in local space.
  // Rim layer reuses the slab geometry so feMorphology traces exact alpha.
  return (
    <g>
      {rimFilter ? (
        <g
          filter={`url(#${rimFilter})`}
          opacity={rimOpacity}
          data-health-rim
          style={{ pointerEvents: 'none' }}
        >
          <RedisSlabs stroke="none" strokeWidth={0} />
        </g>
      ) : null}
      <RedisSlabs stroke={stroke} strokeWidth={strokeWidth} />
      {/* Cloudcraft-measured face marks (not a stamped logo image). */}
      <RedisFaceMarks />
    </g>
  )
}

/** One Redis brand mark = 3 thin slabs (logo art). units = whole-mark fan for replicas. */
export function RedisBrandGlyph({
  x,
  y,
  units = [{ id: 'u0', dx: 0, dy: 0, opacity: 1, scale: 1 }],
  selected = false,
  healthVisual = 'off',
  interactive = false,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: RedisBrandGlyphProps) {
  // Multi-replica nest uses ZoneLayer for selection â€” not per-mark outlines.
  const multi = units.length > 1
  const stroke = selected && !multi ? '#3b82f6' : '#2b0908'
  const strokeWidth = selected && !multi ? 2 : 1
  const rimStyle = resolveRimStyle(healthVisual)
  const rimAlpha = usePulsingAlpha(rimStyle)
  const rimFilter = healthRimFilterId(healthVisual)
  const rimOpacity = rimFilter ? healthRimLayerOpacity(rimAlpha) : 0
  // Shelf: top last. Diamond nest: back first so front marks occlude correctly.
  const ordered = [...units].sort(compareUnitPaintOrder)

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="cache"
      data-engine="redis"
      data-replicas={units.length}
      data-health={healthVisual}
    >
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerEnter={interactive ? onPointerEnter : undefined}
        onPointerLeave={interactive ? onPointerLeave : undefined}
      >
        {ordered.map((u) => (
          <g key={u.id} transform={`translate(${u.dx} ${u.dy}) scale(${u.scale})`} opacity={u.opacity}>
            <RedisMark
              stroke={stroke}
              strokeWidth={strokeWidth}
              rimFilter={rimFilter}
              rimOpacity={rimOpacity}
            />
          </g>
        ))}
      </g>
    </g>
  )
}
