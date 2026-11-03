import { describe, expect, it } from 'vitest'
import type { CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import type { MetaJobsResponse } from '../api'
import { buildJobsPanelModel } from './jobsPanelModel'

const catalog: MetaJobsResponse = {
  catalogVersion: '2',
  jobs: [
    { id: 'main_db', label: 'Main database' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'work_queue', label: 'Work queue' },
    { id: 'hot_cache', label: 'Hot cache' },
  ],
  engines: [],
  pairs: [],
  guarantees: [],
}

function snap(
  templateId: string,
  nodes: CanvasSnapshot['nodes'],
  jobBindings?: Record<string, string>,
): CanvasSnapshot {
  return {
    version: '1.0',
    templateId,
    nodes,
    edges: [],
    exportedAt: new Date(0).toISOString(),
    jobBindings,
  }
}

describe('buildJobsPanelModel', () => {
  it('resolves social-feed defaults onto db and timeline cache', () => {
    const model = buildJobsPanelModel(
      snap('social-feed', [
        {
          id: 'db-1',
          type: 'database',
          label: 'Postgres',
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
      ]),
      catalog,
    )
    const main = model.find((r) => r.jobId === 'main_db')
    const timeline = model.find((r) => r.jobId === 'timeline')
    expect(main?.nodeId).toBe('db-1')
    expect(timeline?.nodeId).toBe('cache-1')
    expect(timeline?.engine).toBe('redis')
  })

  it('uses explicit timeline binding on db', () => {
    const model = buildJobsPanelModel(
      snap(
        'social-feed',
        [
          {
            id: 'db-1',
            type: 'database',
            label: 'Postgres',
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
        { timeline: 'db-1' },
      ),
      catalog,
    )
    const timeline = model.find((r) => r.jobId === 'timeline')
    expect(timeline?.nodeId).toBe('db-1')
    expect(timeline?.explicitBinding).toBe(true)
  })

  it('lists url-shortener optional hot_cache', () => {
    const model = buildJobsPanelModel(
      snap('url-shortener', [
        {
          id: 'db-1',
          type: 'database',
          label: 'DB',
          position: [0, 0, 0],
          config: {},
          status: 'idle',
        },
      ]),
      catalog,
    )
    expect(model.map((r) => r.jobId)).toEqual(['main_db', 'hot_cache'])
    expect(model.find((r) => r.jobId === 'hot_cache')?.required).toBe(false)
  })

  it('lists cache and mq as work_queue candidates on social-feed', () => {
    const model = buildJobsPanelModel(
      snap('social-feed', [
        {
          id: 'mq-1',
          type: 'message_queue',
          label: 'Message Queue',
          position: [0, 0, 0],
          config: { engine: 'rabbitmq' },
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
      ]),
      catalog,
    )
    const queue = model.find((r) => r.jobId === 'work_queue')
    expect(queue?.candidateNodeIds).toEqual(['cache-1', 'mq-1'])
    expect(queue?.allowedEngines).toEqual(['rabbitmq', 'redis'])
    expect(queue?.nodeId).toBe('mq-1')
  })
})
