import { HALF_W } from '../math/iso'
import { logoDataUrl } from '../skins/logos'

type FlatGlyphFaceProps = {
  cx: number
  cy: number
  size: number
  shape: 'ellipse' | 'rect'
  fill: string
  logoId: string | null
  selected: boolean
  t: number
}

/** Upright 2D face for procedural glyphs (Redis, client loadgen). */
export function FlatGlyphFace({
  cx,
  cy,
  size,
  shape,
  fill,
  logoId,
  selected,
  t,
}: FlatGlyphFaceProps) {
  if (t <= 0) return null
  const href = logoId ? logoDataUrl(logoId) : null
  const r = size * (shape === 'ellipse' ? 0.46 : 0.4)
  const mark = r * 0.5
  const stroke = selected ? '#3b82f6' : shape === 'ellipse' ? '#8ea0b5' : '#c5cad3'
  return (
    <g opacity={t} data-flat-face style={{ pointerEvents: 'none' }}>
      {shape === 'ellipse' ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.25}
        />
      ) : (
        <rect
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          rx={r * 0.22}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.25}
        />
      )}
      {href ? (
        <image
          href={href}
          x={cx - mark}
          y={cy - mark}
          width={mark * 2}
          height={mark * 2}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
    </g>
  )
}

export const FLAT_FACE_CX = HALF_W