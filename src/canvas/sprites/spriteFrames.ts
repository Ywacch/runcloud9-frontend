import type { CanvasNode } from '../../editor-core/stores/canvasStore'

/**
 * How replicas are arranged while collapsed:
 * - `stack`: vertical Y-offset tiers (slab-stack / disc-stack archetypes)
 * - `row`: side-by-side along the iso row axis (hex-tube archetype)
 * - `singleton`: never stacks (hex-prism archetype)
 */
export type ReplicaLayoutStrategy = 'stack' | 'row' | 'singleton'

export interface SpriteFrameSpec {
  /** Frame name inside public/spritesheets/components.json. */
  frame: string
  /** Brand color applied via PixiJS `.tint` (frames are grayscale). */
  tint: number
  strategy: ReplicaLayoutStrategy
}

/**
 * Canvas node type -> atlas frame + brand tint. Types absent here (`client`)
 * always render through the procedural path.
 */
const SPRITE_FRAMES: Partial<Record<CanvasNode['type'], SpriteFrameSpec>> = {
  compute: { frame: 'server_base', tint: 0x6b9fd4, strategy: 'stack' },
  cache: { frame: 'cache_base', tint: 0xd82f27, strategy: 'stack' },
  database: { frame: 'database_base', tint: 0x5b9bd5, strategy: 'stack' },
  worker: { frame: 'worker_base', tint: 0x9b71d4, strategy: 'stack' },
  message_queue: { frame: 'queue_base', tint: 0xf5f5f5, strategy: 'row' },
  load_balancer: { frame: 'loadbalancer_base', tint: 0x5bc8af, strategy: 'singleton' },
}

export function spriteFrameForType(
  type: CanvasNode['type'],
): SpriteFrameSpec | null {
  return SPRITE_FRAMES[type] ?? null
}

/** Frames the atlas must contain before sprite rendering is enabled. */
export const EXPECTED_ATLAS_FRAMES: readonly string[] = Object.values(
  SPRITE_FRAMES,
).map((s) => s.frame)
