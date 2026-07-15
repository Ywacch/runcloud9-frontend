import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  applyCacheStrategyNormalizationToNodes,
  getAvailableCacheStrategies,
} from './cacheTopologyStrategy'

function node(
  id: string,
  type: CanvasNode['type'],
  config: CanvasNode['config'] = {},
): CanvasNode {
  return {
    id,
    type,
    label: id,
    position: [0, 0, 0],
    config,
    status: 'idle',
  }
}

function edge(id: string, sourceId: string, targetId: string): CanvasEdge {
  return {
    id,
    sourceId,
    targetId,
    protocol: 'tcp',
    animated: false,
  }
}

describe('getAvailableCacheStrategies', () => {
  it('hides proxy strategies for free tier even on proxy topology', () => {
    const nodes = {
      app: node('app', 'compute'),
      cache: node('cache', 'cache'),
      db: node('db', 'database'),
    }
    const edges = {
      e1: edge('e1', 'cache', 'db'),
    }
    const available = getAvailableCacheStrategies('cache', nodes, edges, {
      allowProxyStrategies: false,
    })
    expect(available).toEqual([])
  })

  it('includes proxy strategies for paid tier on proxy topology', () => {
    const nodes = {
      app: node('app', 'compute'),
      cache: node('cache', 'cache'),
      db: node('db', 'database'),
    }
    const edges = {
      e1: edge('e1', 'cache', 'db'),
    }
    const available = getAvailableCacheStrategies('cache', nodes, edges, {
      allowProxyStrategies: true,
    })
    expect(available).toEqual(['write-through', 'write-behind'])
  })
})

describe('applyCacheStrategyNormalizationToNodes', () => {
  it('snaps legacy read-through to write-through on proxy topology', () => {
    const nodes = {
      app: node('app', 'compute'),
      cache: node('cache', 'cache', {
        cacheStrategy: 'read-through',
        strategy: 'read-through',
      }),
      db: node('db', 'database'),
    }
    const edges = {
      appCache: edge('appCache', 'app', 'cache'),
      cacheDb: edge('cacheDb', 'cache', 'db'),
    }
    const next = applyCacheStrategyNormalizationToNodes(nodes, edges, {
      allowProxyStrategies: true,
    })
    expect(next.cache.config.cacheStrategy).toBe('write-through')
    expect(next.cache.config.strategy).toBe('write-through')
  })
})
