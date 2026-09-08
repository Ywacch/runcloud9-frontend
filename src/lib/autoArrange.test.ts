import { describe, expect, it } from 'vitest'
import { isoToNode, nodeToIso } from '../canvas/utils/positionAdapter'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  boundedPlacementIsoBounds,
  CELL_H,
  CELL_W,
  isoToScreen,
  storePositionInBoundedSlab,
} from '../svg-canvas/math/iso'
import { autoArrangeByDependencyLayers } from './autoArrange'
import { createCanvasNode } from './nodeFactory'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'

function hopZ(
  positions: Record<string, [number, number, number]>,
  from: string,
  to: string,
): number {
  return Math.abs(positions[to][2] - positions[from][2])
}

function screenDelta(
  positions: Record<string, [number, number, number]>,
  from: string,
  to: string,
): { dx: number; dy: number } {
  const a = nodeToIso(positions[from])
  const b = nodeToIso(positions[to])
  const sa = isoToScreen(a.col, a.row)
  const sb = isoToScreen(b.col, b.row)
  return { dx: Math.abs(sb.x - sa.x), dy: Math.abs(sb.y - sa.y) }
}

function chain(
  count: number,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []
  for (let i = 0; i < count; i++) {
    const n = createCanvasNode('compute', isoToNode(0, 0), {})
    n.id = `n${i}`
    nodes.push(n)
    if (i > 0) {
      edges.push({
        id: `e${i}`,
        sourceId: nodes[i - 1].id,
        targetId: n.id,
        protocol: 'http',
        animated: false,
      })
    }
  }
  return { nodes, edges }
}

describe('autoArrangeByDependencyLayers', () => {
  it('spreads a short chain across leftover grid (above the one-cell floor)', () => {
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
    const lbToApp = hopZ(positions, lb.id, app.id)
    const appToDb = hopZ(positions, app.id, db.id)

    expect(lbToApp).toBe(12)
    expect(appToDb).toBe(12)
    expect(lbToApp).toBeGreaterThanOrEqual(4)

    const lbToAppScreen = screenDelta(positions, lb.id, app.id)
    const appToDbScreen = screenDelta(positions, app.id, db.id)
    expect(lbToAppScreen.dx).toBe(CELL_W * 3)
    expect(lbToAppScreen.dy).toBe(CELL_H * 3)
    expect(appToDbScreen.dx).toBe(CELL_W * 3)
    expect(appToDbScreen.dy).toBe(CELL_H * 3)
  })

  it('packs a long chain down to one major cell per hop, filling leftover cells', () => {
    const { nodes, edges } = chain(8)
    const positions = autoArrangeByDependencyLayers(nodes, edges)
    const hops: number[] = []
    for (let i = 1; i < nodes.length; i++) {
      const hop = hopZ(positions, nodes[i - 1].id, nodes[i].id)
      hops.push(hop)
      expect(hop).toBeGreaterThanOrEqual(4)
      const delta = screenDelta(positions, nodes[i - 1].id, nodes[i].id)
      expect(delta.dx).toBeGreaterThanOrEqual(CELL_W)
      expect(delta.dy).toBeGreaterThanOrEqual(CELL_H)
    }
    // floor(15/7)=2 leaves one iso cell; it is given back so the chain
    // spans the bounded row range instead of sitting in a packed band.
    expect(hops.reduce((sum, n) => sum + n, 0)).toBe(30)
    expect(hops.filter((h) => h === 4).length).toBe(6)
    expect(hops.filter((h) => h === 6).length).toBe(1)
  })

  it('uses more of the floor for fewer layers than for many', () => {
    const short = chain(3)
    const long = chain(8)
    const shortPos = autoArrangeByDependencyLayers(short.nodes, short.edges)
    const longPos = autoArrangeByDependencyLayers(long.nodes, long.edges)
    expect(hopZ(shortPos, 'n0', 'n1')).toBeGreaterThan(hopZ(longPos, 'n0', 'n1'))
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
    const appToQueue = hopZ(positions, app.id, queue.id)
    const queueToWorker = hopZ(positions, queue.id, worker.id)
    const workerToCache = hopZ(positions, worker.id, cache.id)

    expect(appToQueue).toBe(8)
    expect(queueToWorker).toBe(14)
    expect(queueToWorker).toBeGreaterThan(appToQueue)
    expect(workerToCache).toBe(8)
  })

  it('reflows when a traffic-source layer is added', () => {
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    const db = createCanvasNode('database', isoToNode(0, 0), {})
    const client = createCanvasNode('client', isoToNode(0, 0), {})
    app.id = 'app'
    db.id = 'db'
    client.id = 'client'

    const withoutClient = autoArrangeByDependencyLayers(
      [app, db],
      [
        {
          id: 'app-db',
          sourceId: app.id,
          targetId: db.id,
          protocol: 'tcp',
          animated: false,
        },
      ],
    )
    const withClient = autoArrangeByDependencyLayers(
      [client, app, db],
      [
        {
          id: 'client-app',
          sourceId: client.id,
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
      ],
    )

    const spanWithout = hopZ(withoutClient, app.id, db.id)
    const spanWith = Math.abs(withClient[client.id][2] - withClient[db.id][2])
    expect(spanWith).toBeGreaterThan(spanWithout)
    expect(withClient[client.id][2]).toBeGreaterThan(withClient[app.id][2])
  })

  it('keeps every node on the bounded SVG floor slab', () => {
    const { nodes, edges } = chain(8)
    const positions = autoArrangeByDependencyLayers(nodes, edges)
    const bounds = boundedPlacementIsoBounds()
    for (const node of nodes) {
      const iso = nodeToIso(positions[node.id])
      expect(iso.col).toBeGreaterThanOrEqual(bounds.minCol)
      expect(iso.col).toBeLessThanOrEqual(bounds.maxCol)
      expect(iso.row).toBeGreaterThanOrEqual(bounds.minRow)
      expect(iso.row).toBeLessThanOrEqual(bounds.maxRow)
      expect(storePositionInBoundedSlab(positions[node.id])).toBe(true)
    }
  })

  it('keeps cache-aside with loadgen and LB on the bounded slab', () => {
    const client = createCanvasNode('client', isoToNode(0, 0), {})
    client.id = CLIENT_LOADGEN_ID
    const lb = createCanvasNode('load_balancer', isoToNode(0, 0), {})
    lb.id = 'lb'
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    app.id = 'app'
    const cache = createCanvasNode('cache', isoToNode(0, 0), {})
    cache.id = 'cache'
    const db = createCanvasNode('database', isoToNode(0, 0), {})
    db.id = 'db'

    const edges: CanvasEdge[] = [
      {
        id: 'client-lb',
        sourceId: client.id,
        targetId: lb.id,
        protocol: 'http',
        animated: true,
      },
      {
        id: 'lb-app',
        sourceId: lb.id,
        targetId: app.id,
        protocol: 'http',
        animated: false,
      },
      {
        id: 'app-cache',
        sourceId: app.id,
        targetId: cache.id,
        protocol: 'tcp',
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

    const positions = autoArrangeByDependencyLayers(
      [client, lb, app, cache, db],
      edges,
    )
    for (const id of [client.id, lb.id, app.id, cache.id, db.id]) {
      expect(storePositionInBoundedSlab(positions[id])).toBe(true)
    }
    expect(positions[client.id][2]).toBeGreaterThan(positions[lb.id][2])
    expect(positions[lb.id][2]).toBeGreaterThan(positions[app.id][2])
  })

  it('keeps social-feed spacing when loadgen is added instead of packing the chain', () => {
    const client = createCanvasNode('client', isoToNode(0, 0), {})
    client.id = CLIENT_LOADGEN_ID
    const lb = createCanvasNode('load_balancer', isoToNode(0, 0), {})
    lb.id = 'lb'
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    app.id = 'app'
    const queue = createCanvasNode('message_queue', isoToNode(0, 0), {})
    queue.id = 'queue'
    const worker = createCanvasNode('worker', isoToNode(0, 0), {})
    worker.id = 'worker'
    const cache = createCanvasNode('cache', isoToNode(0, 0), {})
    cache.id = 'cache'
    const db = createCanvasNode('database', isoToNode(0, 0), {})
    db.id = 'db'

    const edges: CanvasEdge[] = [
      {
        id: 'client-lb',
        sourceId: client.id,
        targetId: lb.id,
        protocol: 'http',
        animated: true,
      },
      {
        id: 'lb-app',
        sourceId: lb.id,
        targetId: app.id,
        protocol: 'http',
        animated: false,
      },
      {
        id: 'app-queue',
        sourceId: app.id,
        targetId: queue.id,
        protocol: 'http',
        animated: false,
      },
      {
        id: 'app-cache',
        sourceId: app.id,
        targetId: cache.id,
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'worker-queue',
        sourceId: worker.id,
        targetId: queue.id,
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
      {
        id: 'worker-db',
        sourceId: worker.id,
        targetId: db.id,
        protocol: 'tcp',
        animated: false,
      },
    ]

    const withoutLoadgen = autoArrangeByDependencyLayers(
      [lb, app, queue, worker, cache, db],
      edges.filter((e) => e.sourceId !== client.id),
    )
    const withLoadgen = autoArrangeByDependencyLayers(
      [client, lb, app, queue, worker, cache, db],
      edges,
    )

    for (const id of [client.id, lb.id, app.id, queue.id, worker.id, cache.id, db.id]) {
      expect(storePositionInBoundedSlab(withLoadgen[id])).toBe(true)
    }

    const spanWithout = hopZ(withoutLoadgen, lb.id, db.id)
    const spanWith = hopZ(withLoadgen, client.id, db.id)
    // Extra ingress hop should occupy leftover diamond, not shrink the graph
    // into a packed band with empty floor around it.
    expect(spanWith).toBeGreaterThanOrEqual(spanWithout)
    expect(hopZ(withLoadgen, client.id, lb.id)).toBeGreaterThan(4)
    expect(hopZ(withLoadgen, lb.id, app.id)).toBeGreaterThan(4)
    const bounds = boundedPlacementIsoBounds()
    const isoSpan = Math.abs(
      nodeToIso(withLoadgen[client.id]).row - nodeToIso(withLoadgen[db.id]).row,
    )
    expect(isoSpan).toBe(bounds.maxRow - bounds.minRow)
  })
})
