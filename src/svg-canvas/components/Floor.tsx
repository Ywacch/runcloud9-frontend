import {
  BOUNDED_COLS,
  BOUNDED_ORIGIN_I,
  BOUNDED_ORIGIN_J,
  BOUNDED_ROWS,
  infiniteFloorDiamond,
  isoFootprintDiamond,
  pointsAttr,
} from '../math/iso'
import type { FloorThemeTokens } from '../theme/floorTheme'

export type GridMode = 'infinite' | 'bounded' | 'off'

type FloorProps = {
  mode: GridMode
  theme: FloorThemeTokens
  viewX: number
  viewY: number
  viewW: number
  viewH: number
}

/**
 * Bounded slab in major (outer) cells. Each major = one 2×2 of inner boxes.
 * More rows than cols elongates the NW–SE edges so the iso parallelogram
 * reads as a wide, flat table (Cloudcraft-style), not a tall diamond.
 * Origin is half-integer so the rim lies on major edges.
 */
export {
  BOUNDED_COLS,
  BOUNDED_MAJOR_COLS,
  BOUNDED_MAJOR_ROWS,
  BOUNDED_ROWS,
} from '../math/iso'
export const BOUNDED_SLAB_THICKNESS = 16
const SLAB_THICKNESS = BOUNDED_SLAB_THICKNESS

type FloorPaintProps = {
  points: string
}

function FloorPaint({ points }: FloorPaintProps) {
  return (
    <>
      <polygon points={points} fill="url(#svgGridPatternMinor)" />
      <polygon points={points} fill="url(#svgGridPatternMajor)" />
    </>
  )
}

export function Floor({
  mode,
  theme,
  viewX,
  viewY,
  viewW,
  viewH,
}: FloorProps) {
  if (mode === 'infinite' || mode === 'off') {
    const diamond = infiniteFloorDiamond(viewX, viewY, viewW, viewH)
    const pts = pointsAttr(diamond)
    return (
      <g data-floor={mode} data-floor-theme={theme.id}>
        <polygon points={pts} fill={theme.floorFill} />
        {mode === 'infinite' ? <FloorPaint points={pts} /> : null}
      </g>
    )
  }

  const top = isoFootprintDiamond(
    BOUNDED_ORIGIN_I,
    BOUNDED_ORIGIN_J,
    BOUNDED_COLS,
    BOUNDED_ROWS,
  )
  const sideFront = [
    top[2],
    top[3],
    { x: top[3].x, y: top[3].y + SLAB_THICKNESS },
    { x: top[2].x, y: top[2].y + SLAB_THICKNESS },
  ]
  const sideRight = [
    top[1],
    top[2],
    { x: top[2].x, y: top[2].y + SLAB_THICKNESS },
    { x: top[1].x, y: top[1].y + SLAB_THICKNESS },
  ]
  const topPts = pointsAttr(top)

  return (
    <g data-floor="bounded" data-floor-theme={theme.id}>
      <polygon points={pointsAttr(sideFront)} fill={theme.slabSideFront} />
      <polygon points={pointsAttr(sideRight)} fill={theme.slabSideRight} />
      <polygon
        points={topPts}
        fill={theme.floorFill}
        stroke={theme.slabRim}
        strokeWidth={2}
      />
      <FloorPaint points={topPts} />
    </g>
  )
}
