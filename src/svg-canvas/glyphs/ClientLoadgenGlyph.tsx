import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import {
  resolveRimStyle,
  usePulsingAlpha,
} from '../fx/healthRimCss'
import {
  healthRimFilterId,
  healthRimLayerOpacity,
} from '../fx/healthRimFilter'
import { CELL_W } from '../math/iso'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** Match Pixi `TILE_H` for the procedural client slab (not SVG floor CELL_H). */
const BODY_H = 64
const SIDE_H = 24
const HW = CELL_W / 2 // 64
const HH = BODY_H / 2 // 32

const FILL = {
  top: '#78b0f0',
  left: '#4878c0',
  right: '#285090',
} as const

const GLYPH = '#d8ecff'
const EDGE = '#2a2a2a'

type ClientLoadgenGlyphProps = {
  x: number
  y: number
  selected?: boolean
  healthVisual?: HealthVisualState
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

/**
 * Traffic-source / loadgen mark — Pixi procedural iso slab + circle→arrow glyph.
 * Tip-local: left tip of the top face at (0,0).
 */
function ClientSlab({ stroke, strokeWidth }: { stroke: string; strokeWidth: number }) {
  const left = `0 0 ${HW} ${HH} ${HW} ${HH + SIDE_H} 0 ${SIDE_H}`
  const right = `${CELL_W} 0 ${HW} ${HH} ${HW} ${HH + SIDE_H} ${CELL_W} ${SIDE_H}`
  const top = `0 0 ${HW} ${-HH} ${CELL_W} 0 ${HW} ${HH}`
  return (
    <g>
      <polygon points={left} fill={FILL.left} stroke={stroke} strokeWidth={strokeWidth} />
      <polygon points={right} fill={FILL.right} stroke={stroke} strokeWidth={strokeWidth} />
      <polygon points={top} fill={FILL.top} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  )
}

/** Face mark: disc + outbound arrow (matches Pixi `drawTypeGlyph` client case). */
function ClientFaceMark() {
  const cx = HW
  const cy = -2
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle
        cx={cx}
        cy={cy}
        r={10}
        fill={GLYPH}
        stroke={EDGE}
        strokeWidth={1}
      />
      <line
        x1={cx + 10}
        y1={cy}
        x2={cx + 18}
        y2={cy}
        stroke={EDGE}
        strokeWidth={1.5}
      />
      <polyline
        points={`${cx + 15},${cy - 3} ${cx + 18},${cy} ${cx + 15},${cy + 3}`}
        fill="none"
        stroke={EDGE}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </g>
  )
}

export function ClientLoadgenGlyph({
  x,
  y,
  selected = false,
  healthVisual = 'off',
  interactive = false,
  onPointerDown,
}: ClientLoadgenGlyphProps) {
  const stroke = selected ? '#3b82f6' : EDGE
  const strokeWidth = selected ? 2 : 0.75
  const rimStyle = resolveRimStyle(healthVisual)
  const rimAlpha = usePulsingAlpha(rimStyle)
  const rimFilter = healthRimFilterId(healthVisual)
  const rimOpacity = rimFilter ? healthRimLayerOpacity(rimAlpha) : 0

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="client"
      data-engine="generic"
      data-health={healthVisual}
    >
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
      >
        {/* Hit target — top diamond + body AABB. */}
        <rect
          x={0}
          y={-HH}
          width={CELL_W}
          height={HH + SIDE_H + HH}
          fill="transparent"
          style={{ pointerEvents: interactive ? 'fill' : 'none' }}
        />
        {rimFilter ? (
          <g
            filter={`url(#${rimFilter})`}
            opacity={rimOpacity}
            data-health-rim
            style={{ pointerEvents: 'none' }}
          >
            <ClientSlab stroke="none" strokeWidth={0} />
          </g>
        ) : null}
        <ClientSlab stroke={stroke} strokeWidth={strokeWidth} />
        <ClientFaceMark />
      </g>
    </g>
  )
}
