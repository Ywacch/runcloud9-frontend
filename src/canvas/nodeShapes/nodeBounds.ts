import type { CanvasNode } from '../../store/canvasStore'

/**
 * Per-type unit-cell sizing for procedurally-rendered nodes. Replica stacking
 * grows the visible group along +Y from this single-unit baseline.
 */
export interface NodeUnitSpec {
  /** Width (X) of one stack unit / collider footprint. */
  w: number
  /** Height (Y) of one stack unit. */
  h: number
  /** Depth (Z) of one stack unit / collider footprint. */
  d: number
  /** Visible gap on Y between stacked units so <Edges> render cleanly. */
  gap: number
  /** Y of the bottom of unit 0 relative to the node group origin. */
  baseY: number
  /** Label clearance above the top of the stack. */
  labelMargin: number
}

export function getNodeUnitSpec(type: CanvasNode['type']): NodeUnitSpec {
  switch (type) {
    case 'client':
      return { w: 1.0, h: 0.18, d: 1.0, gap: 0, baseY: -0.12, labelMargin: 0.32 }
    case 'database':
      return { w: 0.86, h: 0.18, d: 0.86, gap: 0.04, baseY: -0.3, labelMargin: 0.3 }
    case 'cache':
      return { w: 0.82, h: 0.2, d: 0.82, gap: 0.04, baseY: -0.3, labelMargin: 0.3 }
    case 'message_queue':
      // Bounds wrap the horizontal hex cluster (X = tube length, Y/Z = cluster diameter).
      return { w: 1.2, h: 0.85, d: 0.95, gap: 0, baseY: -0.4, labelMargin: 0.3 }
    case 'load_balancer':
      return { w: 1.35, h: 0.34, d: 1.35, gap: 0, baseY: -0.3, labelMargin: 0.3 }
    case 'worker':
      return { w: 0.78, h: 0.16, d: 0.86, gap: 0.04, baseY: -0.3, labelMargin: 0.3 }
    case 'compute':
    default:
      return { w: 0.88, h: 0.18, d: 0.92, gap: 0.04, baseY: -0.3, labelMargin: 0.3 }
  }
}

export function getStackHeight(spec: NodeUnitSpec, count: number): number {
  const n = Math.max(1, count)
  return n * spec.h + Math.max(0, n - 1) * spec.gap
}

export function getStackTopY(spec: NodeUnitSpec, count: number): number {
  return spec.baseY + getStackHeight(spec, count)
}

export function getUnitCenterY(spec: NodeUnitSpec, index: number): number {
  return spec.baseY + spec.h / 2 + index * (spec.h + spec.gap)
}

export function getLabelY(spec: NodeUnitSpec, count: number): number {
  return getStackTopY(spec, count) + spec.labelMargin
}
