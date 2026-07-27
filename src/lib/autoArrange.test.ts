import { describe, expect, it } from 'vitest'
import { isoToNode } from '../canvas/utils/positionAdapter'
import type { CanvasEdge } from '../editor-core/stores/canvasStore'
import { autoArrangeByDependencyLayers } from './autoArrange'
import { createCanvasNode } from './nodeFactory'

describe('autoArrangeByDependencyLayers', () => {
  it('keeps the compact layer step for ordinary hops', () => {
    const lb = createCanvasNode('load_balancer', isoToNode(0, 0), {})
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    const db = createCanvasNode('database', isoToNode(0, 0), {})
    lb.id = 'lb'
    app.id = 'app'
    db.id = 'db'

    const edges: CanvasEdge[] = [
      {
        id: 'lb-app',
        sourceId: lb.id,
        targetId: app.id,
        protocol: 'http',
        animated: false,
      },
      {
        id: 'app-db',
        sourceId: app.id,
        targetId: db.id,
        protocol: 'tcp',
        animated: false,
      },
    ]

    const positions = autoArrangeByDependencyLayers([lb, app, db], edges)
    const lbToApp = Math.abs(positions[app.id][2] - positions[lb.id][2])
    const appToDb = Math.abs(positions[db.id][2] - positions[app.id][2])

    expect(lbToApp).toBe(6)
    expect(appToDb).toBe(6)
  })

  it('leaves extra breathing room after a wide message-queue layer only', () => {
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    const queue = createCanvasNode('message_queue', isoToNode(0, 0), {})
    const worker = createCanvasNode('worker', isoToNode(0, 0), {})
    const cache = createCanvasNode('cache', isoToNode(0, 0), {})
    app.id = 'app'
    queue.id = 'queue'
    worker.id = 'worker'
    cache.id = 'cache'

    const edges: CanvasEdge[] = [
      {
        id: 'app-queue',
        sourceId: app.id,
        targetId: queue.id,
        protocol: 'http',
        animated: false,
      },
      {
        id: 'queue-worker',
        sourceId: queue.id,
        targetId: worker.id,
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'worker-cache',
        sourceId: worker.id,
        targetId: cache.id,
        protocol: 'tcp',
        animated: false,
      },
    ]

    const positions = autoArrangeByDependencyLayers(
      [app, queue, worker, cache],
      edges,
    )
    const appToQueue = Math.abs(
      positions[queue.id][2] - positions[app.id][2],
    )
    const queueToWorker = Math.abs(
      positions[worker.id][2] - positions[queue.id][2],
    )
    const workerToCache = Math.abs(
      positions[cache.id][2] - positions[worker.id][2],
    )

    expect(appToQueue).toBe(6)
    expect(queueToWorker).toBe(10)
    expect(queueToWorker).toBeGreaterThan(appToQueue)
    expect(workerToCache).toBe(6)
  })
})
