import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { UnitOffset } from '../compose/composeAppServer'
import type { BrandTint } from '../skins/engineSkins'
import { EngineBadge } from './EngineBadge'
import type { PointerEvent as ReactPointerEvent } from 'react'

type CacheGlyphProps = {
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

/** Generic cache slab-stack (Memcached path) — thin discs as one instance art. */
function CacheUnit({
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
  const step = 14
  const side = 12
  return (
    <g>
      {[0, 1, 2].map((k) => {
        const y = -k * step
        const top = `0 ${y} ${HALF_W} ${y - HALF_H * 0.55} ${CELL_W} ${y} ${HALF_W} ${y + HALF_H * 0.55}`
        const left = `0 ${y} ${HALF_W} ${y + HALF_H * 0.55} ${HALF_W} ${y + HALF_H * 0.55 + side} 0 ${y + side}`
        const right = `${CELL_W} ${y} ${HALF_W} ${y + HALF_H * 0.55} ${HALF_W} ${y + HALF_H * 0.55 + side} ${CELL_W} ${y + side}`
        const f = 1 - (2 - k) * 0.08
        return (
          <g key={k}>
            <polygon points={left} fill={tint.left} opacity={f} stroke={stroke} strokeWidth={strokeWidth} />
            <polygon points={right} fill={tint.right} opacity={f} stroke={stroke} strokeWidth={strokeWidth} />
            <polygon points={top} fill={tint.top} opacity={f} stroke={stroke} strokeWidth={strokeWidth} />
          </g>
        )
      })}
      {showBadge ? (
        <EngineBadge cx={HALF_W} cy={-2 * step - 4} logoId={logoId} letter={letter} size={20} />
      ) : null}
    </g>
  )
}

export function CacheGlyph({
  x,
  y,
  label,
  units = [{ dx: 0, dy: 0 }],
  tint,
  logoId,
  selected = false,
  interactive = false,
  onPointerDown,
}: CacheGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  const ordered = [...units].sort((a, b) => b.dy - a.dy)
  const topUnit = ordered[ordered.length - 1]

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="cache"
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
            <CacheUnit
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
