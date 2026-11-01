import { useId } from 'react'
import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import type { MotionUnit } from '../store/unitMotionStore'
import { compareUnitPaintOrder } from '../compose/composePacking'
import { HALF_H, HALF_W } from '../math/iso'
import { unitIndexFromMotionId } from '../../lib/canvasInstanceScope'
import {
  resolveRimStyle,
  usePulsingAlpha,
} from '../fx/healthRimCss'
import {
  healthRimFilterId,
  healthRimLayerOpacity,
  HEALTH_RIM_FILTER_IDS,
} from '../fx/healthRimFilter'
import type { BrandTint } from '../skins/engineSkins'
import { tintColorMatrixValues } from '../skins/brandTintFilter'
import { IsoFaceLogo } from './IsoFaceLogo'
import { SPRITE_METRICS, type SpriteKind } from './spriteMetrics'
import type { PointerEvent as ReactPointerEvent } from 'react'

export type { SpriteKind }

const SPRITES = SPRITE_METRICS

function UnitPickHit({
  spec,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  spec: (typeof SPRITE_METRICS)[SpriteKind]
  onPointerDown: (e: ReactPointerEvent<SVGElement>) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const { cx, cy, size, shape } = spec.faceLogo
  const rx = size * 0.36
  const ry = rx * (HALF_H / HALF_W)
  const common = {
    fill: 'transparent' as const,
    style: { pointerEvents: 'fill' as const },
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
  }
  if (shape === 'ellipse') {
    return (
      <ellipse
        cx={cx}
        cy={cy + ry * 0.45}
        rx={rx}
        ry={ry * 1.45}
        {...common}
      />
    )
  }
  return (
    <polygon
      points={`${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry + 14} ${cx - rx},${cy}`}
      {...common}
    />
  )
}

type SpriteBackedGlyphProps = {
  kind: SpriteKind
  x: number
  y: number
  label: string
  /** Replica / shard offsets in node space. */
  units?: MotionUnit[]
  logoId?: string | null
  /** Engine accent; greyscale sprites get a single-channel feColorMatrix. */
  tint?: BrandTint | null
  /** When false, skip face logo (rare). Default true â€” still no-ops if logoId null. */
  showBadge?: boolean
  /** When true (live canvas), keep rim image mounted and drive opacity only. */
  stableHealthRim?: boolean
  selected?: boolean
  healthVisual?: HealthVisualState
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerLeave?: (e: ReactPointerEvent<SVGGElement>) => void
  onUnitPointerDown?: (unitIndex: number, e: ReactPointerEvent<SVGGElement>) => void
  onUnitPointerEnter?: (unitIndex: number) => void
  onUnitPointerLeave?: (unitIndex: number) => void
  /** Kill highlight on every slab. Used when the stack is collapsed. */
  chaosWholeStack?: boolean
  /** Kill highlight only on these unit ids, plus any unit fading out. */
  perUnitChaos?: boolean
  chaosUnitIds?: readonly string[]
}

/** Renders extracted greyscale unit SVGs from `src/assets/components`. */
export function SpriteBackedGlyph({
  kind,
  x,
  y,
  units = [{ id: 'u0', dx: 0, dy: 0, opacity: 1, scale: 1 }],
  logoId = null,
  tint = null,
  showBadge = true,
  stableHealthRim = false,
  selected = false,
  healthVisual = 'off',
  interactive = false,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onUnitPointerDown,
  onUnitPointerEnter,
  onUnitPointerLeave,
  chaosWholeStack = false,
  perUnitChaos = false,
  chaosUnitIds = [],
}: SpriteBackedGlyphProps) {
  const spec = SPRITES[kind]
  const ordered = [...units].sort(compareUnitPaintOrder)
  const unitPick = ordered.length > 1 && onUnitPointerDown != null
  const pickIndex = (id: string): number => unitIndexFromMotionId(units, id)
  // Multi-unit nodes use SvgZone for group chrome — not per-unit selection boxes.
  const perUnitSelect = selected && ordered.length <= 1
  const stroke = perUnitSelect ? '#3b82f6' : 'transparent'
  const strokeWidth = perUnitSelect ? 2.5 : 0
  const baseHealth: HealthVisualState =
    perUnitChaos && healthVisual === 'chaos'
      ? stableHealthRim
        ? 'healthy'
        : 'off'
      : healthVisual
  const rimStyle = resolveRimStyle(baseHealth)
  const rimAlpha = usePulsingAlpha(rimStyle)
  const chaosRimStyle = resolveRimStyle('chaos')
  const chaosAlpha = usePulsingAlpha(chaosRimStyle)
  const chaosIdSet = new Set(chaosUnitIds)
  const baseFilter = healthRimFilterId(baseHealth)
  const chaosFilter = healthRimFilterId('chaos')
  const fallbackFilter = stableHealthRim ? HEALTH_RIM_FILTER_IDS.healthy : null
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
        onPointerDown={interactive && !unitPick ? onPointerDown : undefined}
        onPointerEnter={interactive && !unitPick ? onPointerEnter : undefined}
        onPointerLeave={interactive && !unitPick ? onPointerLeave : undefined}
      >
        {ordered.map((u) => {
          const unitChaos =
            chaosWholeStack ||
            (perUnitChaos && (u.leaving === true || chaosIdSet.has(u.id)))
          const rimFilter = unitChaos
            ? chaosFilter
            : (baseFilter ?? fallbackFilter)
          const rimOpacity = unitChaos
            ? healthRimLayerOpacity(chaosAlpha)
            : baseFilter
              ? healthRimLayerOpacity(rimAlpha)
              : stableHealthRim
                ? healthRimLayerOpacity(0)
                : 0
          const mountRim = rimFilter != null && (stableHealthRim || unitChaos || baseFilter != null)
          return (
          <g key={u.id} transform={`translate(${u.dx} ${u.dy}) scale(${u.scale})`} opacity={u.opacity}>
            {interactive && unitPick ? (
              <UnitPickHit
                spec={spec}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onUnitPointerDown?.(
                    pickIndex(u.id),
                    e as ReactPointerEvent<SVGGElement>,
                  )
                }}
                onPointerEnter={() => onUnitPointerEnter?.(pickIndex(u.id))}
                onPointerLeave={() => onUnitPointerLeave?.(pickIndex(u.id))}
              />
            ) : interactive ? (
              <rect
                x={-spec.tipX}
                y={-spec.tipY}
                width={spec.w}
                height={spec.h}
                fill="transparent"
                style={{ pointerEvents: 'fill' }}
              />
            ) : null}
            {/* Silhouette rim from dilated sprite alpha (shared feMorphology). */}
            {mountRim && rimFilter ? (
              <image
                href={spec.url}
                x={-spec.tipX}
                y={-spec.tipY}
                width={spec.w}
                height={spec.h}
                filter={`url(#${rimFilter})`}
                opacity={rimOpacity}
                data-health-rim
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            <image
              href={spec.url}
              x={-spec.tipX}
              y={-spec.tipY}
              width={spec.w}
              height={spec.h}
              filter={filterId ? `url(#${filterId})` : undefined}
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
          )
        })}
      </g>
    </g>
  )
}
