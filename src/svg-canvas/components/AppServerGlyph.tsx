import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { UnitOffset } from '../compose/composeAppServer'
import type { BrandTint } from '../skins/engineSkins'
import { EngineBadge } from '../glyphs/EngineBadge'
import type { PointerEvent as ReactPointerEvent } from 'react'

type AppServerGlyphProps = {
  x: number
  y: number
  label: string
  units?: UnitOffset[]
  tint?: BrandTint
  logoId?: string | null
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

const DEFAULT_TINT: BrandTint = {
  top: '#e8e8ea',
  left: '#d2d2d4',
  right: '#b8b8bb',
}

function shadeHex(hex: string, factor: number): string {
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
  tint,
  logoId,
}: {
  label: string
  showBadge: boolean
  stroke: string
  strokeWidth: number
  shadeFactor: number
  tint: BrandTint
  logoId: string | null
}) {
  const top = `0 0 ${HALF_W} ${-HALF_H} ${CELL_W} 0 ${HALF_W} ${HALF_H}`
  const left = `0 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} 0 37`
  const right = `${CELL_W} 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} ${CELL_W} 37`
  return (
    <>
      <polygon
        points={left}
        fill={shadeHex(tint.left, shadeFactor)}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={right}
        fill={shadeHex(tint.right, shadeFactor)}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={top}
        fill={shadeHex(tint.top, shadeFactor)}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {showBadge ? (
        <EngineBadge cx={HALF_W} cy={0} logoId={logoId} letter={label} />
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
  tint = DEFAULT_TINT,
  logoId = null,
  selected = false,
  interactive = false,
  onPointerDown,
}: AppServerGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
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
                tint={tint}
                logoId={logoId}
              />
            </g>
          )
        })}
      </g>
    </g>
  )
}
