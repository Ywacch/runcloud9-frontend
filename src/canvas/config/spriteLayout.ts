export interface SpriteLayout {
  /** Uniform scale factor applied to the sprite. */
  scale: number
  /** Anchor point on the texture (0–1 normalized). */
  anchor: { x: number; y: number }
  /** Fine-tune offset from the tile seat position (TILE_W/2, TILE_H/2). */
  offsetX: number
  offsetY: number
}

export const SPRITE_LAYOUT: Record<string, SpriteLayout> = {
  'redis-cache': { scale: 0.52, anchor: { x: 0.5, y: 0.85 }, offsetX: 0, offsetY: 0 },
  database: { scale: 0.48, anchor: { x: 0.5, y: 0.9 }, offsetX: 0, offsetY: 0 },
  lb: { scale: 0.5, anchor: { x: 0.5, y: 0.9 }, offsetX: 0, offsetY: 0 },
  server: { scale: 0.5, anchor: { x: 0.5, y: 0.85 }, offsetX: 0, offsetY: 0 },
  worker: { scale: 0.55, anchor: { x: 0.5, y: 0.85 }, offsetX: 0, offsetY: 0 },
  MQ: { scale: 0.48, anchor: { x: 0.5, y: 0.85 }, offsetX: 0, offsetY: 0 },
}

export const DEFAULT_SPRITE_LAYOUT: SpriteLayout = {
  scale: 0.55,
  anchor: { x: 0.5, y: 0.9 },
  offsetX: 0,
  offsetY: 0,
}
