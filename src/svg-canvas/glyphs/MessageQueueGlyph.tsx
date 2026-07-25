import { HALF_H, HALF_W } from '../math/iso'
import type { BrandTint } from '../skins/engineSkins'
import { EngineBadge } from './EngineBadge'
import type { PointerEvent as ReactPointerEvent } from 'react'

type MessageQueueGlyphProps = {
  x: number
  y: number
  label: string
  tubeCount: number
  tint: BrandTint
  logoId: string | null
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

function tubeOffset(idx: number, count: number): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 }
  if (count === 2) {
    return idx === 0 ? { dx: -28, dy: 8 } : { dx: 28, dy: -8 }
  }
  if (count === 3) {
    const slots = [
      { dx: -32, dy: 12 },
      { dx: 32, dy: 12 },
      { dx: 0, dy: -28 },
    ]
    return slots[idx] ?? { dx: 0, dy: 0 }
  }
  const cols = Math.ceil(Math.sqrt(count))
  const row = Math.floor(idx / cols)
  const col = idx % cols
  const centered = col - (cols - 1) / 2
  return {
    dx: centered * 36,
    dy: row * 22 - (Math.ceil(count / cols) - 1) * 11,
  }
}

function HexTube({
  tint,
  stroke,
  strokeWidth,
}: {
  tint: BrandTint
  stroke: string
  strokeWidth: number
}) {
  return (
    <>
      <polygon
        points={`0 0 ${HALF_W * 0.7} ${-HALF_H * 0.4} ${HALF_W * 1.4} 0 ${HALF_W * 1.4} 28 ${HALF_W * 0.7} ${28 + HALF_H * 0.4} 0 28`}
        fill={tint.top}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={`0 0 ${HALF_W * 0.7} ${HALF_H * 0.4} ${HALF_W * 0.7} ${28 + HALF_H * 0.4} 0 28`}
        fill={tint.left}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={`${HALF_W * 1.4} 0 ${HALF_W * 0.7} ${HALF_H * 0.4} ${HALF_W * 0.7} ${28 + HALF_H * 0.4} ${HALF_W * 1.4} 28`}
        fill={tint.right}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </>
  )
}

export function MessageQueueGlyph({
  x,
  y,
  label,
  tubeCount,
  tint,
  logoId,
  selected = false,
  interactive = false,
  onPointerDown,
}: MessageQueueGlyphProps) {
  const stroke = selected ? '#3b82f6' : '#9ca3af'
  const strokeWidth = selected ? 2 : 1
  const n = Math.max(1, Math.min(6, tubeCount))
  const tubes = Array.from({ length: n }, (_, i) => tubeOffset(i, n))
  const ordered = [...tubes].sort((a, b) => a.dy - b.dy)

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype="message-queue"
      data-shards={n}
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
            <HexTube tint={tint} stroke={stroke} strokeWidth={strokeWidth} />
          </g>
        ))}
        <EngineBadge
          cx={HALF_W * 0.7}
          cy={-36}
          logoId={logoId}
          letter={label}
          size={20}
        />
      </g>
    </g>
  )
}
