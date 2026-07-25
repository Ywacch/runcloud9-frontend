import type { UnitOffset } from '../compose/composeAppServer'
import { compareUnitPaintOrder } from '../compose/composePacking'
import { EngineBadge } from './EngineBadge'
import { SPRITE_METRICS, type SpriteKind } from './spriteMetrics'
import type { PointerEvent as ReactPointerEvent } from 'react'

export type { SpriteKind }

const SPRITES = SPRITE_METRICS

type SpriteBackedGlyphProps = {
  kind: SpriteKind
  x: number
  y: number
  label: string
  /** Replica / shard offsets in node space. */
  units?: UnitOffset[]
  logoId?: string | null
  /** When false, skip EngineBadge (e.g. locked MQ trough). Default true. */
  showBadge?: boolean
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

/** Renders extracted greyscale unit SVGs from `src/assets/components`. */
export function SpriteBackedGlyph({
  kind,
  x,
  y,
  label,
  units = [{ dx: 0, dy: 0 }],
  logoId = null,
  showBadge = true,
  selected = false,
  interactive = false,
  onPointerDown,
}: SpriteBackedGlyphProps) {
  const spec = SPRITES[kind]
  const ordered = [...units].sort(compareUnitPaintOrder)
  const topUnit = ordered[ordered.length - 1]
  // Multi-unit in-plane nests use ZoneLayer — not per-unit boxes.
  const perUnitSelect =
    selected &&
    !(
      (kind === 'message-queue' || kind === 'database') &&
      ordered.length > 1
    )
  const stroke = perUnitSelect ? '#3b82f6' : 'transparent'
  const strokeWidth = perUnitSelect ? 2.5 : 0

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype={kind}
      data-unit-asset="true"
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
            {/* Invisible hit target — <image> alone often ignores pointer events. */}
            <rect
              x={-spec.tipX}
              y={-spec.tipY}
              width={spec.w}
              height={spec.h}
              fill="transparent"
              style={{ pointerEvents: interactive ? 'fill' : 'none' }}
            />
            <image
              href={spec.url}
              x={-spec.tipX}
              y={-spec.tipY}
              width={spec.w}
              height={spec.h}
              style={{ pointerEvents: 'none' }}
            />
            {strokeWidth > 0 ? (
              <rect
                x={-spec.tipX}
                y={-spec.tipY}
                width={spec.w}
                height={spec.h}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                rx={2}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            {showBadge && u === topUnit ? (
              <EngineBadge
                cx={spec.w / 2 - spec.tipX}
                cy={8 - spec.tipY}
                logoId={logoId}
                letter={label}
                size={20}
              />
            ) : null}
          </g>
        ))}
      </g>
    </g>
  )
}
