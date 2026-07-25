import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { UnitOffset } from '../compose/composeAppServer'
import type { BrandTint } from '../skins/engineSkins'
import { EngineBadge } from './EngineBadge'
import type { PointerEvent as ReactPointerEvent } from 'react'

type DatabaseGlyphProps = {
  x: number
  y: number
  label: string
  units?: UnitOffset[]
  tint: BrandTint
  logoId: string | null
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

function DiscStack({
  tint,
  stroke,
  strokeWidth,
  showBadge,
  logoId,
  letter,
}: {
  tint: BrandTint
  stroke: string
  strokeWidth: number
  showBadge: boolean
  logoId: string | null
  letter: string
}) {
  const step = 16
  return (
    <g>
      {[0, 1, 2].map((k) => {
        const y = -k * step
        // Flattened ellipse-ish iso disc via diamond + short sides
        const top = `0 ${y} ${HALF_W} ${y - HALF_H * 0.45} ${CELL_W} ${y} ${HALF_W} ${y + HALF_H * 0.45}`
        const rim = `0 ${y} ${HALF_W} ${y + HALF_H * 0.45} ${HALF_W} ${y + HALF_H * 0.45 + 10} 0 ${y + 10}`
        const rimR = `${CELL_W} ${y} ${HALF_W} ${y + HALF_H * 0.45} ${HALF_W} ${y + HALF_H * 0.45 + 10} ${CELL_W} ${y + 10}`
        return (
          <g key={k}>
            <polygon points={rim} fill={tint.left} stroke={stroke} strokeWidth={strokeWidth} />
            <polygon points={rimR} fill={tint.right} stroke={stroke} strokeWidth={strokeWidth} />
            <polygon points={top} fill={tint.top} stroke={stroke} strokeWidth={strokeWidth} />
          </g>
        )
      })}
      {showBadge ? (
        <EngineBadge cx={HALF_W} cy={-2 * step} logoId={logoId} letter={letter} />
      ) : null}
    </g>
  )
}

export function DatabaseGlyph({
  x,
  y,
  label,
  units = [{ dx: 0, dy: 0 }],
  tint,
  logoId,
  selected = false,
  interactive = false,
  onPointerDown,
}: DatabaseGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  const ordered = [...units].sort((a, b) => b.dy - a.dy)
  const topUnit = ordered[ordered.length - 1]

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="database"
      data-replicas={units.length}
    >
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
      >
        {ordered.map((u, i) => (
          <g key={i} transform={`translate(${u.dx} ${u.dy})`}>
            <DiscStack
              tint={tint}
              stroke={stroke}
              strokeWidth={strokeWidth}
              showBadge={u === topUnit}
              logoId={logoId}
              letter={label}
            />
          </g>
        ))}
      </g>
    </g>
  )
}
