import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode, CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import {
  alignedStockLabel,
  applyEngineChangePreview,
  previewJobEngineChange,
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

  it('moves work_queue onto redis and removes mq when unused', () => {
    const preview = previewJobEngineChange(snapWithMq(), 'work_queue', 'redis')
    expect(preview.bindToNodeId).toBe('cache-1')
    expect(preview.removeNodeIds).toEqual(['mq-1'])
    expect(preview.createNode).toBeNull()
  })

  it('adds a redis node when the timeline is on postgres and the queue is rabbit', () => {
    const preview = previewJobEngineChange(snapQueueOnly(), 'work_queue', 'redis')
    expect(preview.bindToNodeId).toBeNull()
    expect(preview.createNode).toEqual({
      type: 'cache',
      engine: 'redis',
      replaceNodeId: 'mq-1',
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
