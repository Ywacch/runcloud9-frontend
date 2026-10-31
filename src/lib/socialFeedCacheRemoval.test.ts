import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  SOCIAL_FEED_CACHE_REMOVAL_BANNER,
  SOCIAL_FEED_TIMELINE_ON_DB_BANNER,
  socialFeedCacheRemovalBanner,
} from './socialFeedCacheRemoval'

function cacheNode(id: string): CanvasNode {
  return {
    id,
    type: 'cache',
    label: 'Redis',
    position: [0, 0, 0],
    config: {},
    status: 'idle',
  }
}

describe('socialFeedCacheRemovalBanner', () => {
  it('shows banner when last cache removed on social-feed push', () => {
    const prev = { cache: cacheNode('cache') }
    const next = {}
    expect(
      socialFeedCacheRemovalBanner('social-feed', prev, next, 'cache'),
    ).toBe(SOCIAL_FEED_CACHE_REMOVAL_BANNER)
  })

  it('names the Postgres timeline when the job is bound to the database', () => {
    const prev = { cache: cacheNode('cache'), db: {
      id: 'db',
      type: 'database' as const,
      label: 'PostgreSQL',
      position: [0, 0, 0] as [number, number, number],
      config: {},
      status: 'idle' as const,
    } }
    const next = { db: prev.db }
    expect(
      socialFeedCacheRemovalBanner('social-feed', prev, next, 'cache', {
        timeline: 'db',
      }),
    ).toBe(SOCIAL_FEED_TIMELINE_ON_DB_BANNER)
  })

  it('does not show for social-feed-pull', () => {
    const prev = { cache: cacheNode('cache') }
    const next = {}
    expect(
      socialFeedCacheRemovalBanner('social-feed-pull', prev, next, 'cache'),
    ).toBeNull()
  })

  it('does not show when other caches remain', () => {
    const prev = {
      c1: cacheNode('c1'),
      c2: cacheNode('c2'),
    }
    const next = { c2: cacheNode('c2') }
    expect(
      socialFeedCacheRemovalBanner('social-feed', prev, next, 'c1'),
    ).toBeNull()
  })
})
