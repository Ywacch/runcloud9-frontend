import { describe, expect, it } from 'vitest'
import type { CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import { previewJobEngineChange } from './engineChangePreview'

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

  it('keeps redis in place for the redis engine', () => {
    const preview = previewJobEngineChange(snap(), 'timeline', 'redis')
    expect(preview.removeNodeIds).toEqual([])
    expect(preview.patchNodeId).toBe('cache-1')
  })

  it('moves work_queue onto redis and removes mq when unused', () => {
    const preview = previewJobEngineChange(snapWithMq(), 'work_queue', 'redis')
    expect(preview.bindToNodeId).toBe('cache-1')
    expect(preview.removeNodeIds).toEqual(['mq-1'])
  })
})
