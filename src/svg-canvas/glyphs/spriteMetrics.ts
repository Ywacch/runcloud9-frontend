import appServerUrl from '../../assets/components/app-server.svg'
import cacheSlabUrl from '../../assets/components/cache-slab.svg'
import databaseUrl from '../../assets/components/database.svg'
import loadBalancerUrl from '../../assets/components/load-balancer.svg'
import messageQueueUrl from '../../assets/components/message-queue.svg'
import workerUrl from '../../assets/components/worker.svg'

export type SpriteKind =
  | 'app-server'
  | 'cache'
  | 'database'
  | 'worker'
  | 'load-balancer'
  | 'message-queue'

/** Box tops → diamond shear; drum lids → ellipse squash. */
export type FaceShape = 'diamond' | 'ellipse'

/** Logo seat in tip-local space (left tip of primary top face = 0,0). */
export type FaceLogoSeat = {
  /** Top-face center. */
  cx: number
  cy: number
  /** Full width of the face plate (logo fills ~72–78% inside). */
  size: number
  shape: FaceShape
}

export type SpriteMetric = {
  url: string
  w: number
  h: number
  tipX: number
  tipY: number
  faceLogo: FaceLogoSeat
}

/**
 * Display size + tip offset for each extracted unit.
 * tip = left tip of primary top face → maps to node anchor.
 * Shared by SpriteBackedGlyph (rendering) and syncZoneForNode (zone bbox) so
 * group boundaries match the actual art instead of a generic cube footprint.
 */
export const SPRITE_METRICS: Record<SpriteKind, SpriteMetric> = {
  'app-server': {
    url: appServerUrl,
    w: 132,
    h: 113,
    tipX: 10,
    tipY: 48,
    faceLogo: { cx: 56, cy: 0, size: 96, shape: 'diamond' },
  },
  cache: {
    url: cacheSlabUrl,
    w: 132,
    h: 95,
    tipX: 8,
    tipY: 42,
    faceLogo: { cx: 58, cy: 0, size: 76, shape: 'diamond' },
  },
  database: {
    url: databaseUrl,
    // Quiver drum sized near Cloudcraft tier width (~90); tip = left of top ellipse.
    // Stack step 26.084 (db.svg) peeks lower discs as a shelf.
    w: 90,
    h: 76,
    tipX: 1,
    tipY: 26,
    faceLogo: { cx: 44, cy: -1, size: 84, shape: 'ellipse' },
  },
  worker: {
    url: workerUrl,
    w: 132,
    h: 92,
    tipX: 12,
    tipY: 46,
    faceLogo: { cx: 54, cy: 0, size: 92, shape: 'diamond' },
  },
  'load-balancer': {
    url: loadBalancerUrl,
    w: 128,
    h: 123,
    tipX: 14,
    tipY: 44,
    faceLogo: { cx: 50, cy: 0, size: 88, shape: 'diamond' },
  },
  'message-queue': {
    url: messageQueueUrl,
    w: 152,
    h: 115,
    tipX: 8,
    tipY: 58,
    faceLogo: { cx: 68, cy: -6, size: 64, shape: 'diamond' },
  },
}
