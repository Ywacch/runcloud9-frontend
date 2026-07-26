import { spriteBodyBounds, type SpriteLayout } from './spriteLayout'

/**
 * Normalized silhouette vertex (0–1 within the sprite body AABB). Fractions are
 * traced from each SVG's outer stroke path in src/assets/sprites/.
 */
export type RimVertex = { nx: number; ny: number }

/** SLAB-STACK — server.svg outer path M0 32 … L64 104 … (h=104). */
const SLAB_SERVER: RimVertex[] = [
  { nx: 0, ny: 32 / 104 },
  { nx: 0.5, ny: 0 },
  { nx: 1, ny: 32 / 104 },
  { nx: 1, ny: 72 / 104 },
  { nx: 0.5, ny: 1 },
  { nx: 0, ny: 72 / 104 },
]

/** SLAB-STACK — cache.svg outer path (h=84). */
const SLAB_CACHE: RimVertex[] = [
  { nx: 0, ny: 32 / 84 },
  { nx: 0.5, ny: 0 },
  { nx: 1, ny: 32 / 84 },
  { nx: 1, ny: 52 / 84 },
  { nx: 0.5, ny: 1 },
  { nx: 0, ny: 52 / 84 },
]

/** DISC-STACK — worker.svg cylinder outline (bbox x14–114, y4–78). */
const DISC_WORKER: RimVertex[] = [
  { nx: 0, ny: (29 - 4) / (78 - 4) },
  { nx: 0.5, ny: 0 },
  { nx: 1, ny: (29 - 4) / (78 - 4) },
  { nx: 1, ny: (53 - 4) / (78 - 4) },
  { nx: 0.5, ny: 1 },
  { nx: 0, ny: (53 - 4) / (78 - 4) },
]

/** DISC-STACK — database.svg cylinder outline (bbox x8–120, y4–96). */
const DISC_DATABASE: RimVertex[] = [
  { nx: 0, ny: (32 - 4) / (96 - 4) },
  { nx: 0.5, ny: 0 },
  { nx: 1, ny: (32 - 4) / (96 - 4) },
  { nx: 1, ny: (68 - 4) / (96 - 4) },
  { nx: 0.5, ny: 1 },
  { nx: 0, ny: (68 - 4) / (96 - 4) },
]

/**
 * HEX-PRISM — loadbalancer.svg tall prism (atlas aspect ~300×485).
 * Six-face iso outline tuned to the exported artwork proportions.
 */
const HEX_PRISM_LB: RimVertex[] = [
  { nx: 0.04, ny: 0.09 },
  { nx: 0.5, ny: 0 },
  { nx: 0.96, ny: 0.09 },
  { nx: 0.96, ny: 0.9 },
  { nx: 0.5, ny: 1 },
  { nx: 0.04, ny: 0.9 },
]

/** HEX-TUBE — queue.svg outer stroke (8 verts, bbox ~1.14–165.9 × 1.15–124.5). */
const HEX_TUBE_QUEUE: RimVertex[] = [
  { nx: 0, ny: (87.93 - 1.146) / (124.537 - 1.146) },
  { nx: (10.921 - 1.144) / (165.894 - 1.144), ny: (73.976 - 1.146) / (124.537 - 1.146) },
  { nx: (136.238 - 1.144) / (165.894 - 1.144), ny: 0 },
  { nx: (155.869 - 1.144) / (165.894 - 1.144), ny: (12.481 - 1.146) / (124.537 - 1.146) },
  { nx: 1, ny: (38.044 - 1.146) / (124.537 - 1.146) },
  { nx: (156.117 - 1.144) / (165.894 - 1.144), ny: (51.998 - 1.146) / (124.537 - 1.146) },
  { nx: (30.476 - 1.144) / (165.894 - 1.144), ny: 1 },
  { nx: (10.92 - 1.144) / (165.894 - 1.144), ny: (113.21 - 1.146) / (124.537 - 1.146) },
]

const RIM_VERTICES: Record<string, RimVertex[]> = {
  server_base: SLAB_SERVER,
  cache_base: SLAB_CACHE,
  worker_base: DISC_WORKER,
  database_base: DISC_DATABASE,
  loadbalancer_base: HEX_PRISM_LB,
  queue_base: HEX_TUBE_QUEUE,
}

/** Normalized outer-stroke verts for an atlas frame (shared by Pixi + SVG hosts). */
export function normalizedHealthRimVerts(frame: string): RimVertex[] | null {
  const verts = RIM_VERTICES[frame]
  return verts ? verts.map((v) => ({ ...v })) : null
}

/** Screen-space outline polygon for a sprite health rim, per archetype silhouette. */
export function spriteHealthRimPoly(
  frame: string,
  layout: SpriteLayout,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): number[] | null {
  const bounds = spriteBodyBounds(layout)
  const verts = RIM_VERTICES[frame]
  if (!bounds || !verts) return null

  const ox = bounds.x + offset.x
  const oy = bounds.y + offset.y
  const flat: number[] = []
  for (const v of verts) {
    flat.push(ox + v.nx * bounds.w, oy + v.ny * bounds.h)
  }
  return flat
}
