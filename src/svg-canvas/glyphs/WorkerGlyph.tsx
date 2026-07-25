import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { UnitOffset } from '../compose/composeAppServer'
import type { BrandTint } from '../skins/engineSkins'
import { EngineBadge } from './EngineBadge'
import type { PointerEvent as ReactPointerEvent } from 'react'

type WorkerGlyphProps = {
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

/** Worker: truncated cube with angled top accent (distinct from app-server). */
function WorkerUnit({
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
  const top = `16 8 ${HALF_W} ${-HALF_H + 8} ${CELL_W - 16} 8 ${HALF_W} ${HALF_H}`
  const left = `16 8 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 30} 16 ${8 + 30}`
  const right = `${CELL_W - 16} 8 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 30} ${CELL_W - 16} ${8 + 30}`
  return (
    <>
      <polygon points={left} fill={tint.left} stroke={stroke} strokeWidth={strokeWidth} />
      <polygon points={right} fill={tint.right} stroke={stroke} strokeWidth={strokeWidth} />
      <polygon points={top} fill={tint.top} stroke={stroke} strokeWidth={strokeWidth} />
      {showBadge ? (
        <EngineBadge cx={HALF_W} cy={4} logoId={logoId} letter={letter} />
      ) : null}
    </>
  )
}

export function WorkerGlyph({
  x,
  y,
  label,
  units = [{ dx: 0, dy: 0 }],
  tint,
  logoId,
  selected = false,
  interactive = false,
  onPointerDown,
}: WorkerGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  const ordered = [...units].sort((a, b) => b.dy - a.dy)
  const topUnit = ordered[ordered.length - 1]

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="worker"
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
          const shade = 1 - depthFromTop * 0.12
          const shaded: BrandTint = {
            top: tint.top,
            left: tint.left,
            right: tint.right,
          }
          void shade
          return (
            <g key={i} transform={`translate(${u.dx} ${u.dy})`}>
              <WorkerUnit
                tint={shaded}
                stroke={stroke}
                strokeWidth={strokeWidth}
                showBadge={u === topUnit}
                logoId={logoId}
                letter={label}
              />
            </g>
          )
        })}
      </g>
    </g>
  )
}
