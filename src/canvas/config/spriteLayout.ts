import { TILE_H, TILE_W } from '../constants'

export interface SpriteLayout {
  /** Uniform scale factor applied to the sprite (atlas is rasterized at 2x). */
  scale: number
  /** Anchor point on the texture (0–1 normalized). */
  anchor: { x: number; y: number }
  /**
   * Fine-tune offset from the tile seat position (TILE_W/2, TILE_H/2).
   * With a bottom-center anchor, offsetY equals the body's drop below the
   * tile diamond so the sprite's top face aligns with the grid cell.
   */
  offsetX: number
  offsetY: number
  /**
   * Drawn body size in screen px (trimmed atlas frame × scale). Used for
   * selection overlay / hit bounds when the sprite path is active.
   */
  bodyWidth?: number
  bodyHeight?: number
}

/** Keyed by atlas frame name (public/spritesheets/components.json). */
export const SPRITE_LAYOUT: Record<string, SpriteLayout> = {
  cache_base: {
    scale: 0.5,
    anchor: { x: 0.5, y: 1 },
    offsetX: 0,
    offsetY: 21,
    bodyWidth: 128,
    bodyHeight: 87,
  },
  server_base: {
    scale: 0.5,
    anchor: { x: 0.5, y: 1 },
    offsetX: 0,
    offsetY: 41,
    bodyWidth: 128,
    bodyHeight: 107,
  },
  database_base: {
    scale: 0.5,
    anchor: { x: 0.5, y: 1 },
    offsetX: 0,
    offsetY: 33,
    bodyWidth: 114,
    bodyHeight: 94,
  },
  worker_base: {
    scale: 0.5,
    anchor: { x: 0.5, y: 1 },
    offsetX: 0,
    offsetY: 18,
    bodyWidth: 102,
    bodyHeight: 76,
  },
  loadbalancer_base: {
    scale: 0.28,
    anchor: { x: 0.5, y: 1 },
    offsetX: 0,
    offsetY: 30,
    bodyWidth: 64,
    bodyHeight: 101,
  },
  queue_base: {
    scale: 0.5,
    anchor: { x: 0.5, y: 1 },
    offsetX: 0,
    offsetY: 18,
    bodyWidth: 167,
    bodyHeight: 126,
  },
}

export const DEFAULT_SPRITE_LAYOUT: SpriteLayout = {
  scale: 0.5,
  anchor: { x: 0.5, y: 1 },
  offsetX: 0,
  offsetY: 30,
}

/** Screen-space AABB for sprite selection/hit bounds (tile anchor at 0,0). */
export function spriteBodyBounds(layout: SpriteLayout): {
  x: number
  y: number
  w: number
  h: number
} | null {
  if (!layout.bodyWidth || !layout.bodyHeight) return null
  const seatX = TILE_W / 2 + layout.offsetX
  const seatY = TILE_H / 2 + layout.offsetY
  return {
    x: seatX - layout.bodyWidth / 2,
    y: seatY - layout.bodyHeight,
    w: layout.bodyWidth,
    h: layout.bodyHeight,
  }
}

