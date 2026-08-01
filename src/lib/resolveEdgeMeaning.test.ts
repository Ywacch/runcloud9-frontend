import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { TopologyFlags } from './componentRole'
import {
  classifyCanvasEdgeMeaning,
  resolveEdgeMeaning,
} from './resolveEdgeMeaning'
import type { StorytellingSpec } from './storytellingTypes'

const baseTopology: TopologyFlags = {
  hasMQ: true,
  hasWorker: true,
  hasCache: true,
  hasLB: false,
  cacheStrategy: 'cache-aside',
}

const socialFeedStorytelling: StorytellingSpec = {
  edges: {
    'app-server->cache': {
      base: 'App reads follower timelines from Redis (ZREVRANGE on timeline:{userId}).',
      variants: [
        {
          when: { topology: '!hasCache' },
          label: 'No Redis on the canvas. Feed reads fall back to Postgres JOINs.',
        },
      ],
    },
    'worker->cache': {
      base: 'Worker writes timeline:{followerId} sorted sets in Redis after each post.',
    },
  },
}

function node(id: string, type: CanvasNode['type']): CanvasNode {
  return {
    id,
    type,
    label: id,
    position: [0, 0, 0],
    config: {},
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

describe('resolveEdgeMeaning', () => {
  it('uses template storytelling base for social-feed app→cache', () => {
    const message = resolveEdgeMeaning(
      'app-server',
      'cache',
      baseTopology,
      socialFeedStorytelling,
    )
    expect(message).toContain('timeline')
    expect(message).not.toContain('cache host')
  })

  it('applies topology variants when matched', () => {
    const message = resolveEdgeMeaning(
      'app-server',
      'cache',
      { ...baseTopology, hasCache: false },
      socialFeedStorytelling,
    )
    expect(message).toContain('No Redis')
  })

  it('falls back to platform meaning when storytelling omits the pair', () => {
    const message = resolveEdgeMeaning('app-server', 'db', baseTopology, {
      edges: {},
    })
    expect(message).toContain('DB credentials')
  })

  it('falls back to platform meaning when storytelling is absent', () => {
    const message = resolveEdgeMeaning('lb', 'app-server', baseTopology, null)
    expect(message).toContain('Load balancer')
  })
})

describe('classifyCanvasEdgeMeaning', () => {
  it('keeps structural class and swaps active message from storytelling', () => {
    const nodes = {
      app: node('app', 'compute'),
      cache: node('cache', 'cache'),
    }
    const result = classifyCanvasEdgeMeaning(
      edge('e1', 'app', 'cache'),
      nodes,
      true,
      baseTopology,
      socialFeedStorytelling,
    )
    expect(result?.class).toBe('active')
    expect(result?.message).toContain('timeline')
  })

  it('does not override decorative messages', () => {
    const nodes = {
      app: node('app', 'compute'),
      mq: node('mq', 'message_queue'),
    }
    const result = classifyCanvasEdgeMeaning(
      edge('e1', 'app', 'mq'),
      nodes,
      false,
      baseTopology,
      socialFeedStorytelling,
    )
    expect(result?.class).toBe('decorative')
    expect(result?.message).toMatch(/sit idle|does not run async/i)
  })
})
