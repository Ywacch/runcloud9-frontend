import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { UnitOffset } from '../compose/composeAppServer'
import type { PointerEvent as ReactPointerEvent } from 'react'

type AppServerGlyphProps = {
  x: number
  y: number
  label: string
  units?: UnitOffset[]
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * factor)
  const g = Math.round(((n >> 8) & 255) * factor)
  const b = Math.round((n & 255) * factor)
  return `rgb(${r},${g},${b})`
}

function CubeUnit({
  label,
  showBadge,
  stroke,
  strokeWidth,
  shadeFactor,
}: {
  label: string
  showBadge: boolean
  stroke: string
  strokeWidth: number
  shadeFactor: number
}) {
  const top = `0 0 ${HALF_W} ${-HALF_H} ${CELL_W} 0 ${HALF_W} ${HALF_H}`
  const left = `0 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} 0 37`
  const right = `${CELL_W} 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} ${CELL_W} 37`
  return (
    <>
      <polygon
        points={left}
        fill={shade('#d2d2d4', shadeFactor)}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={right}
        fill={shade('#b8b8bb', shadeFactor)}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={top}
        fill={shade('#e8e8ea', shadeFactor)}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {showBadge ? (
        <>
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
        </>
      ) : null}
    </>
  )
}

/**
 * Hand-authored isometric compute cube(s). Anchor = left vertex of primary top face.
 * `units` = whole-unit shelf stack (replicas); never multiplies internal slabs.
 */
export function AppServerGlyph({
  x,
  y,
  label,
  units = [{ dx: 0, dy: 0 }],
  selected = false,
  interactive = false,
  onPointerDown,
}: AppServerGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  // Bottom (dy=0) first → top (most negative dy) last, so shelves peek.
  const ordered = [...units].sort((a, b) => b.dy - a.dy)
  const topUnit = ordered[ordered.length - 1]

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="app-server"
      data-selected={selected ? 'true' : 'false'}
      data-replicas={units.length}
    >
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
      >
        {ordered.map((u, i) => {
          // Top box brightest; lower shelves progressively darker.
          const depthFromTop = ordered.length - 1 - i
          const shadeFactor = 1 - depthFromTop * 0.12
          return (
            <g key={i} transform={`translate(${u.dx} ${u.dy})`}>
              <CubeUnit
                label={label}
                showBadge={u === topUnit}
                stroke={stroke}
                strokeWidth={strokeWidth}
                shadeFactor={shadeFactor}
              />
            </g>
          )
        })}
      </g>
    </g>
  )
}
