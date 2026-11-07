import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode, CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import {
  alignedStockLabel,
  applyEngineChangePreview,
  canShareWorkQueueRedis,
  previewJobEngineChange,
  previewWorkQueueRedis,
  type EngineCanvasOps,
} from './engineChangePreview'

function snap(): CanvasSnapshot {
  return {
    version: '1.0',
    templateId: 'social-feed',
    exportedAt: new Date(0).toISOString(),
    edges: [],
    nodes: [
      {
        id: 'db-1',
        type: 'database',
        label: 'PostgreSQL',
        position: [0, 0, 0],
        config: { engine: 'postgresql' },
        status: 'idle',
      },
      {
        id: 'cache-1',
        type: 'cache',
        label: 'Redis',
        position: [1, 0, 0],
        config: { cacheEngine: 'redis', strategy: 'timeline-store' },
        status: 'idle',
      },
    ],
  }
}

function snapWithMq(): CanvasSnapshot {
  return {
    ...snap(),
    nodes: [
      ...snap().nodes,
      {
        id: 'mq-1',
        type: 'message_queue',
        label: 'Message Queue',
        position: [2, 0, 0],
        config: { engine: 'rabbitmq' },
        status: 'idle',
      },
    ],
  }
}

describe('previewJobEngineChange', () => {
  it('moves timeline onto postgres and removes redis', () => {
    const preview = previewJobEngineChange(snap(), 'timeline', 'postgresql')
    expect(preview.bindToNodeId).toBe('db-1')
    expect(preview.removeNodeIds).toEqual(['cache-1'])
    expect(preview.patchNodeId).toBeNull()
  })

  it('aligns a stock Redis label when the node is already memcached', () => {
    const node = snap().nodes.find((item) => item.id === 'cache-1')
    expect(node).toBeDefined()
    expect(
      alignedStockLabel({
        ...node!,
        config: { ...node!.config, cacheEngine: 'memcached', engine: 'memcached' },
      }),
    ).toBe('Memcached')
  })

  it('renames a stock Redis label when the cache engine becomes memcached', () => {
    const preview = previewJobEngineChange(snap(), 'timeline', 'memcached')
    const ops = memoryOps(snap())
    applyEngineChangePreview(preview, 'timeline', ops)
    expect(ops.nodes['cache-1']?.label).toBe('Memcached')
    expect(ops.nodes['cache-1']?.config.cacheEngine).toBe('memcached')
  })

  it('keeps a custom cache label when the engine changes', () => {
    const source = snap()
    source.nodes = source.nodes.map((node) =>
      node.id === 'cache-1' ? { ...node, label: 'Hot path' } : node,
    )
    const preview = previewJobEngineChange(source, 'timeline', 'memcached')
    const ops = memoryOps(source)
    applyEngineChangePreview(preview, 'timeline', ops)
    expect(ops.nodes['cache-1']?.label).toBe('Hot path')
  })

  it('describes an in-place engine change without repeating the node label', () => {
    const stay = previewJobEngineChange(snap(), 'timeline', 'redis')
    expect(stay.summary).toBe('Stays on Redis')
    const swap = previewJobEngineChange(snap(), 'timeline', 'memcached')
    expect(swap.summary).toBe('Switch to Memcached')
  })

  it('keeps redis in place for the redis engine', () => {
    const preview = previewJobEngineChange(snap(), 'timeline', 'redis')
    expect(preview.removeNodeIds).toEqual([])
    expect(preview.patchNodeId).toBe('cache-1')
  })

  it('treats a timeline cache with no engine as redis', () => {
    const source = snapWithMq()
    source.nodes = source.nodes.map((node) =>
      node.id === 'cache-1'
        ? { ...node, config: { strategy: 'timeline-store' } }
        : node,
    )
    expect(canShareWorkQueueRedis(source)).toBe(true)
  })

  it('share never removes a node that hosts another job', () => {
    const ecommerceMemcached: CanvasSnapshot = {
      version: '1.0',
      templateId: 'ecommerce',
      exportedAt: new Date(0).toISOString(),
      jobBindings: { hot_cache: 'cache-mc', work_queue: 'cache-q' },
      nodes: [
        {
          id: 'db-1',
          type: 'database',
          label: 'PostgreSQL',
          position: [0, 0, 0],
          config: { engine: 'postgresql' },
          status: 'idle',
        },
        {
          id: 'cache-mc',
          type: 'cache',
          label: 'Memcached',
          position: [1, 0, 0],
          config: { cacheEngine: 'memcached', strategy: 'cache-aside' },
          status: 'idle',
        },
        {
          id: 'cache-q',
          type: 'cache',
          label: 'Redis',
          position: [2, 0, 0],
          config: { cacheEngine: 'redis', evictionPolicy: 'noeviction' },
          status: 'idle',
        },
      ],
      edges: [],
    }
    expect(canShareWorkQueueRedis(ecommerceMemcached)).toBe(false)
    const mcShare = previewWorkQueueRedis(ecommerceMemcached, 'share')
    expect(mcShare.removeNodeIds).not.toContain('cache-mc')

    const socialPostgres: CanvasSnapshot = {
      ...snapWithMq(),
      nodes: snapWithMq().nodes.map((node) =>
        node.id === 'cache-1'
          ? {
              ...node,
              type: 'database' as const,
              config: { engine: 'postgresql' },
            }
          : node,
      ),
      jobBindings: { timeline: 'db-1', work_queue: 'mq-1' },
    }
    expect(canShareWorkQueueRedis(socialPostgres)).toBe(false)
    const pgShare = previewWorkQueueRedis(socialPostgres, 'share')
    expect(pgShare.removeNodeIds).not.toContain('db-1')
  })

  it('share removes a leftover second redis and keeps the timeline node', () => {
    const source = snapWithMq()
    source.nodes = [
      ...source.nodes,
      {
        id: 'cache-q',
        type: 'cache',
        label: 'Redis',
        position: [3, 0, 0],
        config: { cacheEngine: 'redis', evictionPolicy: 'noeviction' },
        status: 'idle',
      },
    ]
    source.edges = [
      {
        id: 'e-app-q',
        sourceId: 'db-1',
        targetId: 'cache-q',
        protocol: 'tcp',
        animated: false,
      },
    ]
    source.jobBindings = { work_queue: 'cache-1', timeline: 'cache-1' }
    const preview = previewWorkQueueRedis(source, 'share')
    expect(preview.bindToNodeId).toBe('cache-1')
    expect(preview.removeNodeIds).toContain('cache-q')
    const ops = memoryOps(source)
    applyEngineChangePreview(preview, 'work_queue', ops)
    expect(ops.nodes['cache-q']).toBeUndefined()
    expect(ops.nodes['cache-1']).toBeDefined()
    expect(ops.jobBindings.work_queue).toBe('cache-1')
    expect(Object.values(ops.edges).some((edge) => edge.targetId === 'cache-1')).toBe(
      true,
    )
  })

  it('shares work_queue redis with timeline cache and removes mq when unused', () => {
    const preview = previewWorkQueueRedis(snapWithMq(), 'share')
    expect(preview.bindToNodeId).toBe('cache-1')
    expect(preview.removeNodeIds).toEqual(['mq-1'])
    expect(preview.createNode).toBeNull()
  })

  it('separate from a shared redis connects the app and worker to the new queue', () => {
    const source = snap()
    source.nodes = [
      ...source.nodes,
      {
        id: 'app-1',
        type: 'compute',
        label: 'App server',
        position: [0, 1, 0],
        config: {},
        status: 'idle',
      },
      {
        id: 'worker-1',
        type: 'worker',
        label: 'Fan-out Worker',
        position: [1, 1, 0],
        config: {},
        status: 'idle',
      },
    ]
    source.edges = [
      {
        id: 'e-app-cache',
        sourceId: 'app-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e-worker-cache',
        sourceId: 'worker-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e-worker-db',
        sourceId: 'worker-1',
        targetId: 'db-1',
        protocol: 'tcp',
        animated: false,
      },
    ]
    source.jobBindings = { work_queue: 'cache-1', timeline: 'cache-1' }
    const preview = previewWorkQueueRedis(source, 'separate')
    const ops = memoryOps(source)
    applyEngineChangePreview(preview, 'work_queue', ops, {
      nodeId: 'cache-q',
      edgeId: (index) => `e-new-${index}`,
    })
    expect(ops.jobBindings.work_queue).toBe('cache-q')
    expect(ops.nodes['cache-1']).toBeDefined()
    const targetsFrom = (sourceId: string) =>
      Object.values(ops.edges)
        .filter((edge) => edge.sourceId === sourceId)
        .map((edge) => edge.targetId)
    expect(targetsFrom('worker-1')).toEqual(
      expect.arrayContaining(['cache-1', 'cache-q', 'db-1']),
    )
    expect(targetsFrom('app-1')).toEqual(
      expect.arrayContaining(['cache-1', 'cache-q']),
    )
  })

  it('separate from a shared ecommerce hot cache connects the app and worker', () => {
    const source = snap()
    source.templateId = 'ecommerce'
    source.nodes = [
      ...source.nodes,
      {
        id: 'app-1',
        type: 'compute',
        label: 'App server',
        position: [0, 1, 0],
        config: {},
        status: 'idle',
      },
      {
        id: 'worker-1',
        type: 'worker',
        label: 'Order worker',
        position: [1, 1, 0],
        config: {},
        status: 'idle',
      },
    ]
    source.edges = [
      {
        id: 'e-app-cache',
        sourceId: 'app-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e-worker-cache',
        sourceId: 'worker-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
    ]
    source.jobBindings = { work_queue: 'cache-1', hot_cache: 'cache-1' }
    const preview = previewWorkQueueRedis(source, 'separate')
    const ops = memoryOps(source)
    applyEngineChangePreview(preview, 'work_queue', ops, {
      nodeId: 'cache-q',
      edgeId: (index) => `e-new-${index}`,
    })
    expect(ops.jobBindings.work_queue).toBe('cache-q')
    expect(ops.jobBindings.hot_cache).toBe('cache-1')
    const targetsFrom = (sourceId: string) =>
      Object.values(ops.edges)
        .filter((edge) => edge.sourceId === sourceId)
        .map((edge) => edge.targetId)
    expect(targetsFrom('worker-1')).toEqual(
      expect.arrayContaining(['cache-1', 'cache-q']),
    )
    expect(targetsFrom('app-1')).toEqual(
      expect.arrayContaining(['cache-1', 'cache-q']),
    )
  })

  it('separate work_queue redis adds a second cache and removes mq', () => {
    const preview = previewWorkQueueRedis(snapWithMq(), 'separate')
    expect(preview.bindToNodeId).toBeNull()
    expect(preview.createNode?.replaceNodeId).toBe('mq-1')
    expect(preview.createNode?.evictionPolicy).toBe('noeviction')
    expect(preview.removeNodeIds).toEqual(['mq-1'])
  })

  it('does not add a third cache when work_queue is already on its own redis', () => {
    const source = snapWithMq()
    source.nodes = [
      ...source.nodes.filter((n) => n.id !== 'mq-1'),
      {
        id: 'cache-q',
        type: 'cache',
        label: 'Redis',
        position: [2, 0, 0],
        config: { cacheEngine: 'redis', evictionPolicy: 'noeviction' },
        status: 'idle',
      },
    ]
    source.jobBindings = { work_queue: 'cache-q', timeline: 'cache-1' }
    const preview = previewWorkQueueRedis(source, 'separate')
    expect(preview.createNode).toBeNull()
    expect(preview.patchNodeId).toBe('cache-q')
    expect(preview.bindToNodeId).toBeNull()
  })

  it('previewJobEngineChange shares redis when a timeline cache exists', () => {
    const preview = previewJobEngineChange(snapWithMq(), 'work_queue', 'redis')
    expect(preview.bindToNodeId).toBe('cache-1')
    expect(preview.createNode).toBeNull()
  })

  it('adds a redis node when the timeline is on postgres and the queue is rabbit', () => {
    const preview = previewJobEngineChange(snapQueueOnly(), 'work_queue', 'redis')
    expect(preview.bindToNodeId).toBeNull()
    expect(preview.createNode).toEqual({
      type: 'cache',
      engine: 'redis',
      replaceNodeId: 'mq-1',
      evictionPolicy: 'noeviction',
    })
    expect(preview.removeNodeIds).toEqual(['mq-1'])
  })

  it('moves queue edges onto the new redis node before rabbit is removed', () => {
    const preview = previewJobEngineChange(snapQueueOnly(), 'work_queue', 'redis')
    const ops = memoryOps(snapQueueOnly())
    applyEngineChangePreview(preview, 'work_queue', ops, {
      nodeId: 'cache-new',
      edgeId: (index) => `e-new-${index}`,
    })
    expect(ops.nodes['mq-1']).toBeUndefined()
    expect(ops.nodes['cache-new']?.type).toBe('cache')
    expect(ops.nodes['cache-new']?.config.cacheStrategy).toBe('cache-aside')
    expect(ops.nodes['cache-new']?.config.strategy).toBe('cache-aside')
    expect(ops.nodes['cache-new']?.config.engine).toBe('redis')
    expect(ops.jobBindings.work_queue).toBe('cache-new')
    const targets = Object.values(ops.edges).map((edge) => edge.targetId)
    expect(targets).toContain('cache-new')
    expect(targets).not.toContain('mq-1')
  })
})

function snapQueueOnly(): CanvasSnapshot {
  return {
    version: '1.0',
    templateId: 'social-feed',
    exportedAt: new Date(0).toISOString(),
    jobBindings: { timeline: 'db-1' },
    nodes: [
      {
        id: 'app-1',
        type: 'compute',
        label: 'App server',
        position: [0, 0, 0],
        config: {},
        status: 'idle',
      },
      {
        id: 'worker-1',
        type: 'worker',
        label: 'Fan-out Worker',
        position: [1, 0, 0],
        config: {},
        status: 'idle',
      },
      {
        id: 'mq-1',
        type: 'message_queue',
        label: 'Message Queue',
        position: [2, 0, 0],
        config: { engine: 'rabbitmq' },
        status: 'idle',
      },
      {
        id: 'db-1',
        type: 'database',
        label: 'PostgreSQL',
        position: [3, 0, 0],
        config: { engine: 'postgresql' },
        status: 'idle',
      },
    ],
    edges: [
      {
        id: 'e-app-mq',
        sourceId: 'app-1',
        targetId: 'mq-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e-worker-mq',
        sourceId: 'worker-1',
        targetId: 'mq-1',
        protocol: 'tcp',
        animated: false,
      },
    ],
  }
}

function memoryOps(snapshot: CanvasSnapshot): EngineCanvasOps & {
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  jobBindings: Record<string, string>
} {
  const nodes: Record<string, CanvasNode> = Object.fromEntries(
    snapshot.nodes.map((node) => [node.id, node]),
  )
  const edges: Record<string, CanvasEdge> = Object.fromEntries(
    snapshot.edges.map((edge) => [edge.id, edge]),
  )
  const jobBindings: Record<string, string> = { ...(snapshot.jobBindings ?? {}) }
  return {
    nodes,
    edges,
    jobBindings,
    addNode: (node) => {
      nodes[node.id] = node
    },
    updateNodeConfig: (id, config) => {
      const node = nodes[id]
      if (!node) return
      nodes[id] = { ...node, config: { ...node.config, ...config } }
    },
    updateNodeLabel: (id, label) => {
      const node = nodes[id]
      if (!node) return
      nodes[id] = { ...node, label }
    },
    setJobBinding: (job, nodeId) => {
      if (!nodeId) {
        delete jobBindings[job]
        return
      }
      jobBindings[job] = nodeId
    },
    removeEdge: (id) => {
      delete edges[id]
    },
    addEdge: (edge) => {
      edges[edge.id] = edge
    },
    removeNode: (id) => {
      delete nodes[id]
      for (const edge of Object.values(edges)) {
        if (edge.sourceId === id || edge.targetId === id) delete edges[edge.id]
      }
    },
  }
}
