import { useId } from 'react'
import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import type { UnitOffset } from '../compose/composeAppServer'
import { compareUnitPaintOrder } from '../compose/composePacking'
import {
  resolveRimStyle,
  rimCssColor,
  usePulsingAlpha,
} from '../fx/healthRimCss'
import type { BrandTint } from '../skins/engineSkins'
import { tintColorMatrixValues } from '../skins/brandTintFilter'
import { IsoFaceLogo } from './IsoFaceLogo'
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
  /** Engine accent; greyscale sprites get a single-channel feColorMatrix. */
  tint?: BrandTint | null
  /** When false, skip face logo (rare). Default true — still no-ops if logoId null. */
  showBadge?: boolean
  selected?: boolean
  healthVisual?: HealthVisualState
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

/** Renders extracted greyscale unit SVGs from `src/assets/components`. */
export function SpriteBackedGlyph({
  kind,
  x,
  y,
  label: _label,
  units = [{ dx: 0, dy: 0 }],
  logoId = null,
  tint = null,
  showBadge = true,
  selected = false,
  healthVisual = 'off',
  interactive = false,
  onPointerDown,
}: SpriteBackedGlyphProps) {
  const spec = SPRITES[kind]
  const ordered = [...units].sort(compareUnitPaintOrder)
  // Multi-unit in-plane nests use ZoneLayer — not per-unit boxes for selection.
  // Health rims still paint per unit so stacks and fans both show FX.
  const perUnitSelect =
    selected &&
    !(
      (kind === 'message-queue' || kind === 'database') &&
      ordered.length > 1
    )
  const stroke = perUnitSelect ? '#3b82f6' : 'transparent'
  const strokeWidth = perUnitSelect ? 2.5 : 0
  const rimStyle = resolveRimStyle(healthVisual)
  const rimAlpha = usePulsingAlpha(rimStyle)
  const rimColor = rimStyle ? rimCssColor(rimStyle.color) : null
  const matrix = tintColorMatrixValues(tint)
  const rawId = useId().replace(/:/g, '')
  const filterId = matrix ? `sprite-tint-${rawId}` : null
  const seat = spec.faceLogo

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ pointerEvents: 'none' }}
      data-archetype={kind}
      data-unit-asset="true"
      data-replicas={units.length}
      data-health={healthVisual}
    >
      {filterId && matrix ? (
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={matrix} />
          </filter>
        </defs>
      ) : null}
      <g
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'grab' : undefined,
        }}
        onPointerDown={interactive ? onPointerDown : undefined}
      >
        {ordered.map((u, i) => (
          <g key={i} transform={`translate(${u.dx} ${u.dy})`}>
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
              filter={filterId ? `url(#${filterId})` : undefined}
              style={{ pointerEvents: 'none' }}
            />
            {rimColor ? (
              <rect
                x={-spec.tipX - 1}
                y={-spec.tipY - 1}
                width={spec.w + 2}
                height={spec.h + 2}
                fill="none"
                stroke={rimColor}
                strokeWidth={5}
                rx={3}
                opacity={rimAlpha * 0.45}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            {rimColor ? (
              <rect
                data-health-rim
                x={-spec.tipX}
                y={-spec.tipY}
                width={spec.w}
                height={spec.h}
                fill="none"
                stroke={rimColor}
                strokeWidth={2.5}
                rx={2}
                opacity={rimAlpha}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
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
            {showBadge && logoId ? (
              <IsoFaceLogo
                cx={seat.cx}
                cy={seat.cy}
                size={seat.size}
                shape={seat.shape}
                logoId={logoId}
              />
            ) : null}
          </g>
        ))}
      </g>
    </g>
  )
}
