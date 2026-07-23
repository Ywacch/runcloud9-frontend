import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { PointerEvent as ReactPointerEvent } from 'react'

type AppServerGlyphProps = {
  x: number
  y: number
  label: string
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

/**
 * Hand-authored isometric compute cube. Anchor = left vertex of the top face.
 * Face geometry uses the research lattice numbers {0,64,128} × {0,37,74}.
 * Hits are on painted faces only (shape-accurate).
 */
export function AppServerGlyph({
  x,
  y,
  label,
  selected = false,
  interactive = false,
  onPointerDown,
}: AppServerGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  const top = `0 0 ${HALF_W} ${-HALF_H} ${CELL_W} 0 ${HALF_W} ${HALF_H}`
  const left = `0 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} 0 37`
  const right = `${CELL_W} 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} ${CELL_W} 37`

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="app-server"
      data-selected={selected ? 'true' : 'false'}
    >
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
      >
        <polygon
          points={left}
          fill="#d2d2d4"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={right}
          fill="#b8b8bb"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={top}
          fill="#e8e8ea"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </g>
      <circle cx={HALF_W} cy={0} r={10} fill="#3b82f6" />
      <text
        x={HALF_W}
        y={4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#fff"
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  )
}
