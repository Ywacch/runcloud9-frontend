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
})
