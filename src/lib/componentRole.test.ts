import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { getTopologyFlags, withCacheEngineName } from './componentRole'

describe('withCacheEngineName', () => {
  it('replaces Redis when the cache engine is memcached', () => {
    expect(
      withCacheEngineName(
        'App checks Redis; on miss it reads Postgres and SETs the key',
        'memcached',
      ),
    ).toBe('App checks Memcached; on miss it reads Postgres and SETs the key')
  })

  it('leaves Redis copy when the engine is redis', () => {
    const text = 'App checks Redis for short:{code} on the hot resolve path.'
    expect(withCacheEngineName(text, 'redis')).toBe(text)
  })
})

describe('getTopologyFlags readConsistency', () => {
  it('exposes readConsistency from the first database node', () => {
    const db: CanvasNode = {
      id: 'db',
      type: 'database',
      label: 'DB',
      position: [0, 0, 0],
      config: { readReplicas: 2, readConsistency: 'monotonic' },
      status: 'idle',
    }
    const flags = getTopologyFlags({ db })
    expect(flags.readConsistency).toBe('monotonic')
    expect(flags.dbReadReplicas).toBe(2)
  })

  it('defaults readConsistency when no database nodes exist', () => {
    const flags = getTopologyFlags({})
    expect(flags.readConsistency).toBe('leader-only')
    expect(flags.hasDB).toBe(false)
  })
})
