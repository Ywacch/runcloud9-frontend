import type { SvgNode } from '../store/svgTypes'
import { CELL_W } from '../math/iso'
import {
  CC_HALF_H,
  CC_HALF_W,
  CC_REDIS_SIDE_H,
} from '../compose/cloudcraftRedisBrand'
import { SPRITE_METRICS, type SpriteKind } from '../glyphs/spriteMetrics'

/** Pixi walkthrough cyan `0x22d3ee`. */
export const WALKTHROUGH_CYAN = '#22d3ee'

export type GlyphArtBox = { x: number; y: number; w: number; h: number }

function archetypeToSpriteKind(archetype: SvgNode['archetype']): SpriteKind | null {
  switch (archetype) {
    case 'app-server':
      return 'app-server'
    case 'database':
      return 'database'
    case 'cache':
      return 'cache'
    case 'message-queue':
      return 'message-queue'
    case 'load-balancer':
      return 'load-balancer'
    case 'worker':
      return 'worker'
    default:
      return null
  }
}

/** Tip-local art AABB for a node (primary unit), padded like Pixi walkthrough overlay. */
export function walkthroughGlyphArtBox(
  node: SvgNode,
  pad = 8,
): GlyphArtBox {
  if (node.archetype === 'client') {
    const bodyH = 64
    const sideH = 24
    const hh = bodyH / 2
    const h = hh + sideH + hh
    return {
      x: node.x - pad,
      y: node.y - hh - pad,
      w: CELL_W + pad * 2,
      h: h + pad * 2,
    }
  }

  if (node.archetype === 'cache' && node.engine === 'redis') {
    const w = CC_HALF_W * 2
    const h = CC_HALF_H + CC_REDIS_SIDE_H + CC_HALF_H
    return {
      x: node.x - pad,
      y: node.y - CC_HALF_H - pad,
      w: w + pad * 2,
      h: h + pad * 2,
    }
  }

  const kind = archetypeToSpriteKind(node.archetype)
  if (!kind) {
    return { x: node.x - 40 - pad, y: node.y - 40 - pad, w: 80 + pad * 2, h: 80 + pad * 2 }
  }
  const spec = SPRITE_METRICS[kind]
  return {
    x: node.x - spec.tipX - pad,
    y: node.y - spec.tipY - pad,
    w: spec.w + pad * 2,
    h: spec.h + pad * 2,
  }
}

/** Pixi `0xRRGGBB` → CSS `#rrggbb`. */
export function walkthroughCssColor(hex: number): string {
  return `#${(hex >>> 0).toString(16).padStart(6, '0')}`
}
