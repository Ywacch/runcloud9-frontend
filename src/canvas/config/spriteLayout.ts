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
}

/** Keyed by atlas frame name (public/spritesheets/components.json). */
export const SPRITE_LAYOUT: Record<string, SpriteLayout> = {
  cache_base: { scale: 0.5, anchor: { x: 0.5, y: 1 }, offsetX: 0, offsetY: 21 },
  server_base: { scale: 0.5, anchor: { x: 0.5, y: 1 }, offsetX: 0, offsetY: 41 },
  database_base: { scale: 0.5, anchor: { x: 0.5, y: 1 }, offsetX: 0, offsetY: 33 },
  worker_base: { scale: 0.5, anchor: { x: 0.5, y: 1 }, offsetX: 0, offsetY: 18 },
  loadbalancer_base: { scale: 0.5, anchor: { x: 0.5, y: 1 }, offsetX: 0, offsetY: 53 },
  queue_base: { scale: 0.5, anchor: { x: 0.5, y: 1 }, offsetX: 0, offsetY: 18 },
}

export const DEFAULT_SPRITE_LAYOUT: SpriteLayout = {
  scale: 0.5,
  anchor: { x: 0.5, y: 1 },
  offsetX: 0,
  offsetY: 30,
}
