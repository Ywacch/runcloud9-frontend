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

export type SpriteMetric = {
  url: string
  w: number
  h: number
  tipX: number
  tipY: number
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
  },
  cache: {
    url: cacheSlabUrl,
    w: 132,
    h: 95,
    tipX: 8,
    tipY: 42,
  },
  database: {
    url: databaseUrl,
    // Quiver drum sized near Cloudcraft tier width (~90); tip = left of top ellipse.
    // Stack step 26.084 (db.svg) peeks lower discs as a shelf.
    w: 90,
    h: 76,
    tipX: 1,
    tipY: 26,
  },
  worker: {
    url: workerUrl,
    w: 132,
    h: 92,
    tipX: 12,
    tipY: 46,
  },
  'load-balancer': {
    url: loadBalancerUrl,
    w: 128,
    h: 123,
    tipX: 14,
    tipY: 44,
  },
  'message-queue': {
    url: messageQueueUrl,
    w: 152,
    h: 115,
    tipX: 8,
    tipY: 58,
  },
}
