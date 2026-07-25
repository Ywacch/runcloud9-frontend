import {
  infiniteFloorDiamond,
  isoFootprintDiamond,
  pointsAttr,
} from '../math/iso'

export type GridMode = 'infinite' | 'bounded'

type FloorProps = {
  mode: GridMode
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
export const BOUNDED_MAJOR_COLS = 5
export const BOUNDED_MAJOR_ROWS = 9
export const BOUNDED_COLS = BOUNDED_MAJOR_COLS * 2
export const BOUNDED_ROWS = BOUNDED_MAJOR_ROWS * 2
const BOUNDED_ORIGIN_I = -BOUNDED_MAJOR_COLS + 0.5
const BOUNDED_ORIGIN_J = -BOUNDED_MAJOR_ROWS + 0.5
const SLAB_THICKNESS = 16

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

export function Floor({ mode, viewX, viewY, viewW, viewH }: FloorProps) {
  if (mode === 'infinite') {
    const diamond = infiniteFloorDiamond(viewX, viewY, viewW, viewH)
    const pts = pointsAttr(diamond)
    return (
      <g data-floor="infinite">
        <polygon points={pts} fill="#ffffff" />
        <FloorPaint points={pts} />
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
    <g data-floor="bounded">
      <polygon points={pointsAttr(sideFront)} fill="#d4d4d8" />
      <polygon points={pointsAttr(sideRight)} fill="#a1a1aa" />
      <polygon
        points={topPts}
        fill="#ffffff"
        stroke="#54626f"
        strokeWidth={2}
      />
      <FloorPaint points={topPts} />
    </g>
  )
}
