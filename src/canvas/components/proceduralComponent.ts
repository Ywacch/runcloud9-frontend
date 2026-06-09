import { Container, Graphics } from 'pixi.js'
import { TILE_W, TILE_H, tileTopFacePoly } from '../constants'
import { COMPONENT_COLORS } from '../config/componentColors'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'

const EDGE = 0x2a2a2a

function darken(hex: number, factor: number): number {
  const r = Math.floor(((hex >> 16) & 0xff) * factor)
  const g = Math.floor(((hex >> 8) & 0xff) * factor)
  const b = Math.floor((hex & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

function lighten(hex: number, amount: number): number {
  const r = Math.min(255, ((hex >> 16) & 0xff) + amount)
  const g = Math.min(255, ((hex >> 8) & 0xff) + amount)
  const b = Math.min(255, (hex & 0xff) + amount)
  return (r << 16) | (g << 8) | b
}

/** Center of the top-face diamond in local tile coordinates. */
function topCenter(ox: number, oy: number): { x: number; y: number } {
  return { x: ox + TILE_W / 2, y: oy }
}

function drawIsoBody(
  g: Graphics,
  ox: number,
  oy: number,
  colors: (typeof COMPONENT_COLORS)[CanvasNode['type']],
  sH: number,
  factor: number,
  outline: boolean,
): void {
  g.poly(tileTopFacePoly(ox, oy)).fill({ color: darken(colors.top, factor) })
  g.poly([
    ox,
    oy,
    ox + TILE_W / 2,
    oy + TILE_H / 2,
    ox + TILE_W / 2,
    oy + TILE_H / 2 + sH,
    ox,
    oy + sH,
  ]).fill({ color: darken(colors.left, factor) })
  g.poly([
    ox + TILE_W,
    oy,
    ox + TILE_W / 2,
    oy + TILE_H / 2,
    ox + TILE_W / 2,
    oy + TILE_H / 2 + sH,
    ox + TILE_W,
    oy + sH,
  ]).fill({ color: darken(colors.right, factor) })
  g.poly(tileTopFacePoly(ox, oy)).stroke({
    color: EDGE,
    width: outline ? 1 : 0.75,
    alpha: outline ? 0.45 : 0.35,
  })
}

/**
 * Vertical screen-space rise between stacked replica boxes. Deliberately smaller
 * than any body's `sideHeight` so each lower box's top face peeks out as a
 * "shelf" above the one in front of it (Cloudcraft-style stacked servers),
 * instead of leaving a gap that reads as a floating slab.
 */
const STACK_STEP = 16

/** Top-face `oy` of replica box `i` (i=0 is the front/base box at oy=0). */
function collapsedSlabOy(i: number): number {
  return -i * STACK_STEP
}

export function collapsedStackTopY(
  type: CanvasNode['type'],
  layers: number,
): number {
  const sH = COMPONENT_COLORS[type].sideHeight
  if (layers <= 1) return -TILE_H / 2 - sH

  // Highest point = top vertex of the rear-most box's top diamond.
  return collapsedSlabOy(layers - 1) - TILE_H / 2
}

function drawTypeGlyph(
  g: Graphics,
  type: CanvasNode['type'],
  ox: number,
  oy: number,
  top: number,
  factor: number,
): void {
  const c = topCenter(ox, oy)
  const glyph = lighten(top, Math.round(18 * factor))
  const stroke = darken(top, 0.55)

  switch (type) {
    case 'compute': {
      const w = 22
      const h = 16
      g.roundRect(c.x - w / 2, c.y - h / 2 - 2, w, h, 2)
        .fill({ color: glyph })
        .stroke({ color: stroke, width: 1 })
      g.rect(c.x - w / 2 + 4, c.y - h / 2 + 1, w - 8, h - 6).fill({ color: stroke, alpha: 0.35 })
      break
    }
    case 'database': {
      g.ellipse(c.x, c.y - 2, 18, 9).fill({ color: glyph }).stroke({ color: stroke, width: 1 })
      g.ellipse(c.x, c.y - 6, 14, 5).stroke({ color: stroke, width: 0.75, alpha: 0.5 })
      break
    }
    case 'cache': {
      g.roundRect(c.x - 14, c.y - 10, 28, 18, 3)
        .fill({ color: glyph })
        .stroke({ color: stroke, width: 1 })
      for (let i = 0; i < 3; i++) {
        g.rect(c.x - 10 + i * 7, c.y - 6, 4, 10).fill({ color: stroke, alpha: 0.4 })
      }
      break
    }
    case 'load_balancer': {
      g.roundRect(c.x - 20, c.y - 6, 40, 12, 2)
        .fill({ color: glyph })
        .stroke({ color: stroke, width: 1 })
      g.moveTo(c.x - 14, c.y).lineTo(c.x - 6, c.y).stroke({ color: stroke, width: 1.5 })
      g.moveTo(c.x + 6, c.y).lineTo(c.x + 14, c.y).stroke({ color: stroke, width: 1.5 })
      g.circle(c.x, c.y, 3).fill({ color: stroke })
      break
    }
    case 'message_queue': {
      for (let i = -1; i <= 1; i++) {
        const hx = c.x + i * 14
        g.poly([
          hx,
          c.y - 8,
          hx + 7,
          c.y - 4,
          hx + 7,
          c.y + 4,
          hx,
          c.y + 8,
          hx - 7,
          c.y + 4,
          hx - 7,
          c.y - 4,
        ])
          .fill({ color: glyph })
          .stroke({ color: stroke, width: 0.75 })
      }
      break
    }
    case 'worker': {
      g.circle(c.x, c.y - 2, 11).fill({ color: glyph }).stroke({ color: stroke, width: 1 })
      for (let a = 0; a < 6; a++) {
        const rad = (a * Math.PI) / 3
        g.moveTo(c.x + Math.cos(rad) * 6, c.y - 2 + Math.sin(rad) * 4)
          .lineTo(c.x + Math.cos(rad) * 11, c.y - 2 + Math.sin(rad) * 7)
          .stroke({ color: stroke, width: 1.25 })
      }
      break
    }
    case 'client': {
      g.circle(c.x, c.y - 2, 10).fill({ color: glyph }).stroke({ color: stroke, width: 1 })
      g.moveTo(c.x + 10, c.y - 2).lineTo(c.x + 18, c.y - 2).stroke({ color: stroke, width: 1.5 })
      g.moveTo(c.x + 15, c.y - 5).lineTo(c.x + 18, c.y - 2).lineTo(c.x + 15, c.y + 1)
        .stroke({ color: stroke, width: 1.25 })
      break
    }
    default:
      break
  }
}

/** Add one procedural isometric component slab to a parent container. */
export function addProceduralSlab(
  parent: Container,
  node: CanvasNode,
  ox: number,
  oy: number,
  options?: { factor?: number; outline?: boolean; showGlyph?: boolean; sideHeight?: number },
): void {
  const factor = options?.factor ?? 1
  const outline = options?.outline ?? false
  const colors = COMPONENT_COLORS[node.type]
  const sH = options?.sideHeight ?? colors.sideHeight
  const showGlyph = options?.showGlyph ?? true

  const g = new Graphics()
  g.eventMode = 'none'
  drawIsoBody(g, ox, oy, colors, sH, factor, outline)
  if (showGlyph) {
    drawTypeGlyph(g, node.type, ox, oy, colors.top, factor)
  }
  parent.addChild(g)
}

/**
 * Crisp outline along a box's front-bottom silhouette (the lower "V" plus the
 * three vertical edges). In a stack this traces the bottom of each box, which is
 * exactly where one shelf meets the next, so the layers read as distinct steps
 * instead of merging into one tall block.
 */
function drawShelfSeparator(
  g: Graphics,
  ox: number,
  oy: number,
  colors: (typeof COMPONENT_COLORS)[CanvasNode['type']],
  sH: number,
): void {
  const line = { color: darken(colors.right, 0.45), width: 1.25, alpha: 0.9 }
  // Front-bottom V: left edge → bottom vertex → right edge.
  g.moveTo(ox, oy + sH)
    .lineTo(ox + TILE_W / 2, oy + TILE_H / 2 + sH)
    .lineTo(ox + TILE_W, oy + sH)
    .stroke(line)
  // Vertical corner seams down each visible edge.
  g.moveTo(ox, oy).lineTo(ox, oy + sH).stroke(line)
  g.moveTo(ox + TILE_W, oy).lineTo(ox + TILE_W, oy + sH).stroke(line)
  g.moveTo(ox + TILE_W / 2, oy + TILE_H / 2)
    .lineTo(ox + TILE_W / 2, oy + TILE_H / 2 + sH)
    .stroke(line)
}

/**
 * Collapsed replica stack: N identical full-height boxes offset straight up by
 * `STACK_STEP` (< body height) so each lower box peeks out as a thin shelf
 * beneath the one on top (Cloudcraft-style stacked servers). Drawn bottom-up so
 * the highest box paints last, sits fully visible on top, and carries the glyph.
 * Lower boxes are progressively darkened so the shelves read as depth.
 */
export function addCollapsedReplicaStack(
  parent: Container,
  node: CanvasNode,
  layers: number,
): void {
  const colors = COMPONENT_COLORS[node.type]
  const sH = colors.sideHeight

  // Draw bottom box first, highest (top) box last so it paints over the rest.
  for (let i = 0; i < layers; i++) {
    const oy = collapsedSlabOy(i)
    const isTop = i === layers - 1
    // Top box brightest; lower shelves progressively darker for depth.
    const factor = 1 - (layers - 1 - i) * 0.12

    const g = new Graphics()
    g.eventMode = 'none'
    drawIsoBody(g, 0, oy, colors, sH, factor, true)
    drawShelfSeparator(g, 0, oy, colors, sH)

    if (isTop) {
      drawTypeGlyph(g, node.type, 0, oy, colors.top, 1)
    }
    parent.addChild(g)
  }
}
