import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { deployConfigForNode } from './deployPayload'

function cacheNode(config: CanvasNode['config']): CanvasNode {
  return {
    id: 'cache-1',
    type: 'cache',
    label: 'Redis',
    position: [0, 0, 0],
    config,
    status: 'idle',
  }
}

describe('deployConfigForNode', () => {
  it('keeps evictionPolicy on cache nodes and defaults when missing', () => {
    const withPolicy = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'cache-aside',
        evictionPolicy: 'volatile-ttl',
        maxMemoryMB: 256,
      }),
    )
    expect(withPolicy.evictionPolicy).toBe('volatile-ttl')
    expect(withPolicy.maxMemoryMB).toBeUndefined()
    expect(withPolicy.maxMemory).toBeUndefined()
    expect(withPolicy.cacheStrategy).toBe('cache-aside')
    expect(withPolicy.strategy).toBe('cache-aside')

    const missing = deployConfigForNode(
      cacheNode({ cacheStrategy: 'write-through' }),
    )
    expect(missing.evictionPolicy).toBe('allkeys-lru')
    expect(missing.strategy).toBe('write-through')

    const bogus = deployConfigForNode(
      cacheNode({ evictionPolicy: 'something-else' }),
    )
    expect(bogus.evictionPolicy).toBe('allkeys-lru')
  })

  it('syncs proxyInstanceSize ↔ proxyResourceProfile for proxy strategies', () => {
    const explicit = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'write-through',
        instanceSize: 'small',
        proxyInstanceSize: 'large',
      }),
    )
    expect(explicit.proxyInstanceSize).toBe('large')
    expect(explicit.proxyResourceProfile).toBe('large')
    expect(explicit.instanceSize).toBe('small')
    expect(explicit.resourceProfile).toBe('small')

    const defaults = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'write-behind',
        instanceSize: 'medium',
      }),
    )
    expect(defaults.proxyInstanceSize).toBe('medium')
    expect(defaults.proxyResourceProfile).toBe('medium')
  })

  it('omits proxy size keys for cache-aside', () => {
    const aside = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'cache-aside',
        proxyInstanceSize: 'large',
        proxyResourceProfile: 'large',
      }),
    )
    expect(aside.proxyInstanceSize).toBeUndefined()
    expect(aside.proxyResourceProfile).toBeUndefined()
  })

  it('emits a numeric writeBehindIntervalSeconds only for url-shortener write-behind', () => {
    const active = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'write-behind',
        writeBehindIntervalSeconds: 45,
      }),
      'url-shortener',
    )
    expect(active.writeBehindIntervalSeconds).toBe(45)

    const defaults = deployConfigForNode(
      cacheNode({ cacheStrategy: 'write-behind' }),
      'url-shortener',
    )
    expect(defaults.writeBehindIntervalSeconds).toBe(30)

    const clamped = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'write-behind',
        writeBehindIntervalSeconds: 999,
      }),
      'url-shortener',
    )
    expect(clamped.writeBehindIntervalSeconds).toBe(300)

    const writeThrough = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'write-through',
        writeBehindIntervalSeconds: 45,
      }),
      'url-shortener',
    )
    expect(writeThrough.writeBehindIntervalSeconds).toBeUndefined()

    const ecommerce = deployConfigForNode(
      cacheNode({
        cacheStrategy: 'write-behind',
        writeBehindIntervalSeconds: 45,
      }),
      'ecommerce',
    )
    expect(ecommerce.writeBehindIntervalSeconds).toBeUndefined()
  })

  it('emits numeric cacheTtlSeconds when valid and omits when missing/invalid', () => {
    const timed = deployConfigForNode(
      cacheNode({ cacheStrategy: 'cache-aside', cacheTtlSeconds: 300 }),
      'url-shortener',
    )
    expect(timed.cacheTtlSeconds).toBe(300)

    const none = deployConfigForNode(
      cacheNode({ cacheStrategy: 'cache-aside', cacheTtlSeconds: 0 }),
      'social-feed',
    )
    expect(none.cacheTtlSeconds).toBe(0)

    const missing = deployConfigForNode(
      cacheNode({ cacheStrategy: 'cache-aside' }),
      'url-shortener',
    )
    expect(missing.cacheTtlSeconds).toBeUndefined()

    const invalid = deployConfigForNode(
      cacheNode({ cacheStrategy: 'cache-aside', cacheTtlSeconds: 99999 }),
      'url-shortener',
    )
    expect(invalid.cacheTtlSeconds).toBeUndefined()
  })

  it('does not copy cacheTtlSeconds onto non-cache nodes', () => {
    const app = deployConfigForNode(
      {
        id: 'app',
        type: 'compute',
        label: 'App',
        position: [0, 0, 0],
        config: { replicas: 1, cacheTtlSeconds: 300 },
        status: 'idle',
      },
      'url-shortener',
    )
    // Non-cache configs are not TTL-normalized; stray keys are left alone.
    expect(app.cacheTtlSeconds).toBe(300)
    expect(app.replicas).toBe(1)
  })
})
