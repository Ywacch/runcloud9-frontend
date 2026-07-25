import { HALF_W, HALF_H } from '../math/iso'
import { logoDataUrl } from '../skins/logos'

type EngineBadgeProps = {
  cx: number
  cy: number
  size?: number
  logoId: string | null
  letter: string
}

/** Face badge: vendored/stand-in logo or letter chip. */
export function EngineBadge({
  cx,
  cy,
  size = 22,
  logoId,
  letter,
}: EngineBadgeProps) {
  const href = logoId ? logoDataUrl(logoId) : null
  if (href) {
    return (
      <image
        href={href}
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        style={{ pointerEvents: 'none' }}
      />
    )
  }
  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={size / 2}
        fill="#3b82f6"
        style={{ pointerEvents: 'none' }}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#fff"
        fontWeight={700}
        style={{ pointerEvents: 'none' }}
      >
        {letter.slice(0, 2)}
      </text>
    </>
  )
}

/** Default badge seat: center of an iso top face from left tip. */
export const TOP_FACE_CENTER = { x: HALF_W, y: 0 }
export const BADGE_Y = -HALF_H * 0.15
