import { describe, expect, it } from 'vitest'
import { isoToNode } from '../../canvas/utils/positionAdapter'
import type { CanvasEdge, CanvasNode } from '../../editor-core/stores/canvasStore'
import { autoArrangeByDependencyLayers } from '../../lib/autoArrange'
import { createCanvasNode } from '../../lib/nodeFactory'
import { canvasNodeToSvgNode } from '../bridge/canvasSvgAdapter'
import { HALF_H, HALF_W, isoToScreen, pathInBoundedSlab, type WorldPoint } from '../math/iso'
import { faceCenter } from './attach'
import type { SvgNode } from '../store/svgTypes'
import ex1 from './fixtures/ex1-fan-out.stub.json'
import ex2 from './fixtures/ex2-diagonal.stub.json'
import {
  segmentEndpoints,
  type RoutingFixture,
} from './fixtures/fixtureTypes'
import {
  is8AxisSegment,
  isIsoDiagonal,
  routeConnectorScene,
} from './connectorSegments'
import { glyphHitbox, pathHitsBystanders, pathsCross } from './connectorClearance'

function node(
  id: string,
  i: number,
  j: number,
  archetype: SvgNode['archetype'] = 'app-server',
): SvgNode {
  const p = isoToScreen(i, j)
  return {
    id,
    archetype,
    engine: 'generic',
    x: p.x,
    y: p.y,
    label: id,
    config: {},
    topology: { replicas: 1, shards: 1, packing: 'stack' },
  }
}

function assertFixtureAxes(fixture: RoutingFixture) {
  for (const seg of fixture.segments) {
    const [a, b] = segmentEndpoints(seg)
    expect(is8AxisSegment(a, b)).toBe(true)
  }
}

function unit(a: WorldPoint, b: WorldPoint): WorldPoint {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function reverses(path: WorldPoint[]): boolean {
  for (let i = 2; i < path.length; i++) {
    const a = unit(path[i - 2], path[i - 1])
    const b = unit(path[i - 1], path[i])
    // Iso i-then-j elbows meet at ~120° (dot ≈ -0.5). A real U-turn is ~180°.
    if (a.x * b.x + a.y * b.y < -0.9) return true
  }
  return false
}

function bends(path: WorldPoint[]): number {
  let count = 0
  for (let i = 2; i < path.length; i++) {
    const a = unit(path[i - 2], path[i - 1])
    const b = unit(path[i - 1], path[i])
    if (Math.abs(a.x * b.x + a.y * b.y - 1) > 1e-6) count += 1
  }
  return count
}

function longestScreenAxis(path: WorldPoint[]): number {
  let max = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx < 1 || dy < 1) max = Math.max(max, Math.hypot(dx, dy))
  }
  return max
}

function primaryRunIsIso(path: WorldPoint[]): boolean {
  if (path.length === 2) {
    return isIsoDiagonal(path[0], path[1]) || is8AxisSegment(path[0], path[1])
  }
  let iso = 0
  let hv = 0
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    if (isIsoDiagonal(path[i - 1], path[i])) iso += len
    else hv += len
  }
  return iso >= hv
}

describe('connectorSegments', () => {
  it('classifies connection-ex fixture segments on 8 axes', () => {
    assertFixtureAxes(ex1 as RoutingFixture)
    assertFixtureAxes(ex2 as RoutingFixture)
  })

  it('documents connection-ex-1 as iso, short H trunk, iso', () => {
    const fixture = ex1 as RoutingFixture
    expect(fixture.segments).toHaveLength(3)
    expect(isIsoDiagonal(
      { x: fixture.segments[0].x1, y: fixture.segments[0].y1 },
      { x: fixture.segments[0].x2, y: fixture.segments[0].y2 },
    )).toBe(true)
    expect(fixture.segments[1].y1).toBe(fixture.segments[1].y2)
    expect(Math.abs(fixture.segments[1].x2 - fixture.segments[1].x1)).toBe(64)
    expect(isIsoDiagonal(
      { x: fixture.segments[2].x1, y: fixture.segments[2].y1 },
      { x: fixture.segments[2].x2, y: fixture.segments[2].y2 },
    )).toBe(true)
    expect(fixture.sharedVertices).toEqual([{ x: 144, y: 675 }])
    expect(fixture.arrowAtEndOnly).toBe(true)
  })

  it('documents connection-ex-2 as one iso diagonal', () => {
    const fixture = ex2 as RoutingFixture
    const [a, b] = segmentEndpoints(fixture.segments[0])
    expect(fixture.segments).toHaveLength(1)
    expect(isIsoDiagonal(a, b)).toBe(true)
  })

  it('routes a 1:1 open-field offset as an iso elbow, not screen H/V', () => {
    const nodes = [
      node('a', 0, 0),
      node('b', 6, 2, 'database'),
    ]
    const edges = [{ id: 'e', sourceId: 'a', targetId: 'b' }]
    const path = routeConnectorScene({ nodes, zones: [], edges }).get('e') ?? []
    expect(path.length).toBeGreaterThanOrEqual(2)
    expect(path.length).toBeLessThanOrEqual(3)
    for (let i = 0; i < path.length - 1; i++) {
      expect(is8AxisSegment(path[i], path[i + 1])).toBe(true)
    }
    expect(primaryRunIsIso(path)).toBe(true)
    expect(reverses(path)).toBe(false)
  })

  it('keeps worker fan-out on iso diamonds with at most one bend', () => {
    const nodes = [
      node('worker', 0, -5, 'worker'),
      node('cache', -3, -8, 'cache'),
      node('db', 3, -8, 'database'),
    ]
    const edges = [
      { id: 'toCache', sourceId: 'worker', targetId: 'cache' },
      { id: 'toDb', sourceId: 'worker', targetId: 'db' },
    ]
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    for (const id of ['toCache', 'toDb']) {
      const path = routes.get(id) ?? []
      expect(path.length).toBeGreaterThanOrEqual(2)
      expect(bends(path)).toBeLessThanOrEqual(1)
      expect(primaryRunIsIso(path)).toBe(true)
      expect(reverses(path)).toBe(false)
    }
  })

  it('keeps app fan-out to cache and queue as iso-primary legs', () => {
    const nodes = [
      node('app', 0, 4),
      node('cache', -3, -8, 'cache'),
      node('mq', 0, 1, 'message-queue'),
    ]
    const edges = [
      { id: 'toCache', sourceId: 'app', targetId: 'cache' },
      { id: 'toMq', sourceId: 'app', targetId: 'mq' },
    ]
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    for (const id of ['toCache', 'toMq']) {
      const path = routes.get(id) ?? []
      expect(path.length).toBeGreaterThanOrEqual(2)
      expect(bends(path)).toBeLessThanOrEqual(1)
      expect(reverses(path)).toBe(false)
      expect(primaryRunIsIso(path)).toBe(true)
    }
  })

  it('uses screen-horizontal runs when ports share a row', () => {
    const y = isoToScreen(0, 2).y
    const nodes = [
      node('a', 0, 2),
      node('b', 4, -2),
    ]
    const edges = [{ id: 'e', sourceId: 'a', targetId: 'b' }]
    const path = routeConnectorScene({ nodes, zones: [], edges }).get('e') ?? []
    expect(path.length).toBe(2)
    expect(path[0].y).toBeCloseTo(y, 0)
    expect(path[1].y).toBeCloseTo(y, 0)
    void HALF_H
    void HALF_W
    void longestScreenAxis
  })

  it('arranges social-feed app→cache without a CAD screen-L across the floor', () => {
    const specs: [string, Parameters<typeof createCanvasNode>[0]][] = [
      ['app', 'compute'],
      ['cache', 'cache'],
      ['mq', 'message_queue'],
      ['worker', 'worker'],
      ['db', 'database'],
    ]
    const canvasNodes: CanvasNode[] = specs.map(([id, kind]) => {
      const n = createCanvasNode(kind, isoToNode(0, 0), {})
      n.id = id
      return n
    })
    const canvasEdges: CanvasEdge[] = [
      ['e1', 'app', 'cache'],
      ['e2', 'app', 'mq'],
      ['e3', 'mq', 'worker'],
      ['e4', 'worker', 'cache'],
      ['e5', 'worker', 'db'],
    ].map(([id, s, t]) => ({
      id,
      sourceId: s,
      targetId: t,
      protocol: 'http',
      animated: false,
    }))
    const positions = autoArrangeByDependencyLayers(canvasNodes, canvasEdges)
    const nodes: SvgNode[] = canvasNodes.map((n) =>
      canvasNodeToSvgNode({ ...n, position: positions[n.id] ?? n.position }),
    )
    const edges = canvasEdges.map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
    }))
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    for (const e of edges) {
      const path = routes.get(e.id) ?? []
      expect(path.length).toBeGreaterThanOrEqual(2)
      expect(path.length).toBeLessThanOrEqual(4)
      expect(bends(path)).toBeLessThanOrEqual(2)
      for (let i = 1; i < path.length; i++) {
        expect(is8AxisSegment(path[i - 1], path[i])).toBe(true)
      }
      const bystanders = nodes
        .filter((n) => n.id !== e.sourceId && n.id !== e.targetId)
        .map(glyphHitbox)
      expect(pathHitsBystanders(path, bystanders)).toBe(false)
    }
    const appCache = routes.get('e1') ?? []
    const shareRow = Math.abs(appCache[0].y - appCache[appCache.length - 1].y) < 1
    const shareCol = Math.abs(appCache[0].x - appCache[appCache.length - 1].x) < 1
    if (!shareRow && !shareCol) {
      expect(primaryRunIsIso(appCache)).toBe(true)
    }
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const appDb = routes.get('e5')
    if (appDb && byId.get('cache')) {
      expect(pathHitsBystanders(appDb, [glyphHitbox(byId.get('cache')!)])).toBe(
        false,
      )
    }
  })

  it('does not run the last stub past Postgres on social-feed fan-out', () => {
    const specs: [string, Parameters<typeof createCanvasNode>[0]][] = [
      ['app-1', 'compute'],
      ['mq-1', 'message_queue'],
      ['worker-1', 'worker'],
      ['cache-1', 'cache'],
      ['db-1', 'database'],
    ]
    const canvasNodes: CanvasNode[] = specs.map(([id, kind]) => {
      const n = createCanvasNode(kind, isoToNode(0, 0), {})
      n.id = id
      return n
    })
    const canvasEdges: CanvasEdge[] = [
      ['e-app-mq', 'app-1', 'mq-1'],
      ['e-worker-mq', 'worker-1', 'mq-1'],
      ['e-worker-db', 'worker-1', 'db-1'],
      ['e-worker-cache', 'worker-1', 'cache-1'],
      ['e-app-cache', 'app-1', 'cache-1'],
      ['e-app-db', 'app-1', 'db-1'],
    ].map(([id, s, t]) => ({
      id,
      sourceId: s,
      targetId: t,
      protocol: 'tcp',
      animated: false,
    }))
    const positions = autoArrangeByDependencyLayers(canvasNodes, canvasEdges)
    const nodes: SvgNode[] = canvasNodes.map((n) =>
      canvasNodeToSvgNode({ ...n, position: positions[n.id] ?? n.position }),
    )
    const edges = canvasEdges.map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
    }))
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    const db = nodes.find((n) => n.id === 'db-1')
    expect(db).toBeTruthy()
    const dbFace = faceCenter(db!, 'database')
    for (const e of edges) {
      const path = routes.get(e.id) ?? []
      expect(path.length).toBeGreaterThanOrEqual(2)
      expect(path.length).toBeLessThanOrEqual(4)
      const bystanders = nodes
        .filter((n) => n.id !== e.sourceId && n.id !== e.targetId)
        .map(glyphHitbox)
      expect(pathHitsBystanders(path, bystanders)).toBe(false)
    }
    for (const id of ['e-worker-db', 'e-app-db']) {
      const path = routes.get(id) ?? []
      const from = path[path.length - 2]
      const last = path[path.length - 1]
      const toX = last.x - path[0].x
      const toY = last.y - path[0].y
      const lastX = last.x - from.x
      const lastY = last.y - from.y
      expect(lastX * toX + lastY * toY).toBeGreaterThan(-1e-3)
      const lastDist = Math.hypot(last.x - dbFace.x, last.y - dbFace.y)
      expect(lastDist).toBeLessThan(80)
    }
    const independent: [string, string][] = [
      ['e-app-db', 'e-worker-cache'],
      ['e-app-cache', 'e-worker-db'],
      ['e-app-mq', 'e-worker-db'],
      ['e-worker-mq', 'e-app-db'],
    ]
    for (const [a, b] of independent) {
      expect(pathsCross(routes.get(a) ?? [], routes.get(b) ?? [])).toBe(false)
    }
  })

  it('routes around a bystander on the same iso axis instead of painting through it', () => {
    const nodes = [
      node('src', 0, 0, 'worker'),
      node('mid', 4, 0, 'cache'),
      node('dst', 8, 0, 'database'),
    ]
    const edges = [{ id: 'e', sourceId: 'src', targetId: 'dst' }]
    const path = routeConnectorScene({ nodes, zones: [], edges }).get('e') ?? []
    expect(path.length).toBeGreaterThanOrEqual(3)
    expect(path.length).toBeLessThanOrEqual(4)
    for (let i = 1; i < path.length; i++) {
      expect(is8AxisSegment(path[i - 1], path[i])).toBe(true)
    }
    expect(pathHitsBystanders(path, [glyphHitbox(nodes[1])])).toBe(false)
  })

  it('uncrosses independent edges when the other iso corner is free', () => {
    const nodes = [
      node('a', 0, 0),
      node('b', 8, 4, 'database'),
      node('c', 0, 4, 'cache'),
      node('d', 8, 0, 'worker'),
    ]
    const edges = [
      { id: 'ab', sourceId: 'a', targetId: 'b' },
      { id: 'cd', sourceId: 'c', targetId: 'd' },
    ]
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    const ab = routes.get('ab') ?? []
    const cd = routes.get('cd') ?? []
    expect(ab.length).toBeGreaterThanOrEqual(2)
    expect(cd.length).toBeGreaterThanOrEqual(2)
    expect(pathsCross(ab, cd)).toBe(false)
  })

  it('routes cache-aside fan-out around the outside of the triangle', () => {
    const nodes = [
      node('app', 0, 2),
      node('cache', -2, -6, 'cache'),
      node('db', 6, 0, 'database'),
    ]
    const edges = [
      { id: 'e-app-cache', sourceId: 'app', targetId: 'cache' },
      { id: 'e-app-db', sourceId: 'app', targetId: 'db' },
    ]
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    const ac = routes.get('e-app-cache') ?? []
    const ad = routes.get('e-app-db') ?? []
    expect(ac.length).toBeGreaterThanOrEqual(2)
    expect(ad.length).toBeGreaterThanOrEqual(2)
    expect(pathsCross(ac, ad)).toBe(false)
    if (ac.length >= 3) {
      const src = ac[0]
      const dst = ac[ac.length - 1]
      const mid = ac[1]
      const db = faceCenter(nodes[2], 'database')
      const cSide =
        (dst.x - src.x) * (db.y - src.y) - (dst.y - src.y) * (db.x - src.x)
      const mSide =
        (dst.x - src.x) * (mid.y - src.y) - (dst.y - src.y) * (mid.x - src.x)
      expect(mSide * cSide).toBeLessThanOrEqual(0)
    }
  })

  it('does not cross ecommerce async shafts, including fan-out from the app', () => {
    const specs: [string, Parameters<typeof createCanvasNode>[0]][] = [
      ['app-1', 'compute'],
      ['mq-1', 'message_queue'],
      ['worker-1', 'worker'],
      ['cache-1', 'cache'],
      ['db-1', 'database'],
    ]
    const canvasNodes: CanvasNode[] = specs.map(([id, kind]) => {
      const n = createCanvasNode(kind, isoToNode(0, 0), {})
      n.id = id
      return n
    })
    const canvasEdges: CanvasEdge[] = [
      ['e-app-mq', 'app-1', 'mq-1'],
      ['e-worker-mq', 'worker-1', 'mq-1'],
      ['e-worker-db', 'worker-1', 'db-1'],
      ['e-app-cache', 'app-1', 'cache-1'],
      ['e-app-db', 'app-1', 'db-1'],
    ].map(([id, s, t]) => ({
      id,
      sourceId: s,
      targetId: t,
      protocol: 'tcp',
      animated: false,
    }))
    const positions = autoArrangeByDependencyLayers(canvasNodes, canvasEdges)
    const nodes: SvgNode[] = canvasNodes.map((n) =>
      canvasNodeToSvgNode({ ...n, position: positions[n.id] ?? n.position }),
    )
    const edges = canvasEdges.map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
    }))
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        expect(
          pathsCross(
            routes.get(edges[i].id) ?? [],
            routes.get(edges[j].id) ?? [],
          ),
        ).toBe(false)
      }
    }
  })

  it('keeps app→db on the bounded slab when LB blocks the outer hop', () => {
    const specs: [string, Parameters<typeof createCanvasNode>[0]][] = [
      ['lb-1', 'load_balancer'],
      ['app-1', 'compute'],
      ['mq-1', 'message_queue'],
      ['worker-1', 'worker'],
      ['cache-1', 'cache'],
      ['db-1', 'database'],
    ]
    const canvasNodes: CanvasNode[] = specs.map(([id, kind]) => {
      const n = createCanvasNode(kind, isoToNode(0, 0), {})
      n.id = id
      if (kind === 'compute') {
        n.config = { ...n.config, replicas: 2 }
      }
      return n
    })
    const canvasEdges: CanvasEdge[] = [
      ['e-lb-app', 'lb-1', 'app-1'],
      ['e-app-mq', 'app-1', 'mq-1'],
      ['e-worker-mq', 'worker-1', 'mq-1'],
      ['e-worker-db', 'worker-1', 'db-1'],
      ['e-worker-cache', 'worker-1', 'cache-1'],
      ['e-app-cache', 'app-1', 'cache-1'],
      ['e-app-db', 'app-1', 'db-1'],
    ].map(([id, s, t]) => ({
      id,
      sourceId: s,
      targetId: t,
      protocol: 'tcp',
      animated: false,
    }))
    const positions = autoArrangeByDependencyLayers(canvasNodes, canvasEdges)
    const nodes: SvgNode[] = canvasNodes.map((n) =>
      canvasNodeToSvgNode({ ...n, position: positions[n.id] ?? n.position }),
    )
    const edges = canvasEdges.map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
    }))
    const routes = routeConnectorScene({ nodes, zones: [], edges })
    for (const e of edges) {
      const path = routes.get(e.id) ?? []
      expect(path.length).toBeGreaterThanOrEqual(2)
      expect(pathInBoundedSlab(path)).toBe(true)
    }
    const appDb = routes.get('e-app-db') ?? []
    expect(appDb.length).toBeLessThanOrEqual(4)
  })
})
