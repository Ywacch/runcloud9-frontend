import { attachPoint, faceCenter } from './attach'
import {
  glyphHitbox,
  pathHitsBystanders,
  pathsCross,
  type GlyphHitbox,
} from './connectorClearance'
import type { SvgNode } from '../store/svgTypes'
import type { SvgZone } from '../store/svgTypes'
import { HALF_H, HALF_W, isoToScreen, pathInBoundedSlab, screenToIso, type WorldPoint } from '../math/iso'

export type ConnectorEdgeRef = {
  id: string
  sourceId: string
  targetId: string
}

function nodeById(nodes: SvgNode[]): Map<string, SvgNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

function mergeCollinear(points: WorldPoint[]): WorldPoint[] {
  if (points.length <= 2) return points
  const out: WorldPoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]
    const cur = points[i]
    const next = points[i + 1]
    const dx1 = cur.x - prev.x
    const dy1 = cur.y - prev.y
    const dx2 = next.x - cur.x
    const dy2 = next.y - cur.y
    const collinear =
      Math.abs(dx1 * dy2 - dy1 * dx2) < 1e-6 && (dx1 !== 0 || dy1 !== 0)
    if (collinear && is8AxisSegment(prev, next)) continue
    out.push(cur)
  }
  out.push(points[points.length - 1])
  return out
}

function pointsEqual(a: WorldPoint, b: WorldPoint, eps = 0.5): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
}

export function is8AxisSegment(a: WorldPoint, b: WorldPoint): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  if (dx < 1e-3 || dy < 1e-3) return true
  const ratio = dy / dx
  const iso = HALF_H / HALF_W
  return Math.abs(ratio - iso) < 0.04 || Math.abs(ratio + iso) < 0.04
}

/** True when the segment follows an iso diamond axis (not screen H/V). */
export function isIsoDiagonal(a: WorldPoint, b: WorldPoint): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  if (dx < 1e-3 || dy < 1e-3) return false
  const iso = HALF_H / HALF_W
  return Math.abs(dy / dx - iso) < 0.04
}

function lastLegOvershoots(
  source: WorldPoint,
  from: WorldPoint,
  target: WorldPoint,
): boolean {
  const toX = target.x - source.x
  const toY = target.y - source.y
  const lastX = target.x - from.x
  const lastY = target.y - from.y
  return lastX * toX + lastY * toY < -1e-6
}

function pathIs8Axis(path: WorldPoint[]): boolean {
  return path.every((_, i, arr) => i === 0 || is8AxisSegment(arr[i - 1], arr[i]))
}

function pathValid(path: WorldPoint[], source: WorldPoint, target: WorldPoint): boolean {
  if (path.length < 2 || path.length > 4) return false
  if (!pathIs8Axis(path)) return false
  if (lastLegOvershoots(source, path[path.length - 2], target)) return false
  return true
}

function pathKey(path: WorldPoint[]): string {
  return path.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join('|')
}

function firstLegDot(path: WorldPoint[], source: WorldPoint, target: WorldPoint): number {
  const first = path[1] ?? target
  return (first.x - source.x) * (target.x - source.x) + (first.y - source.y) * (target.y - source.y)
}

function sceneCentroid(nodes: SvgNode[]): WorldPoint | null {
  if (nodes.length === 0) return null
  let x = 0
  let y = 0
  for (const n of nodes) {
    const c = faceCenter(n)
    x += c.x
    y += c.y
  }
  return { x: x / nodes.length, y: y / nodes.length }
}

/** Signed area of triangle (a,b,p). Positive = p left of a→b. */
function sideOf(a: WorldPoint, b: WorldPoint, p: WorldPoint): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
}

/**
 * Prefer the parallelogram corner on the far side of the cluster so fan-out
 * wraps outside the triangle instead of through it.
 */
function outwardScore(
  path: WorldPoint[],
  source: WorldPoint,
  target: WorldPoint,
  centroid: WorldPoint | null,
): number {
  if (!centroid || path.length < 3) return 0
  const mid = path[1]
  const cSide = sideOf(source, target, centroid)
  const mSide = sideOf(source, target, mid)
  const dist = Math.hypot(mid.x - centroid.x, mid.y - centroid.y)
  const opposite = Math.abs(cSide) > 1 && mSide * cSide < 0
  return (opposite ? 1_000_000 : 0) + dist
}

function pathHopExtent(path: WorldPoint[]): number {
  if (path.length <= 2) return 0
  let len = 0
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  }
  const straight = Math.hypot(
    path[path.length - 1].x - path[0].x,
    path[path.length - 1].y - path[0].y,
  )
  return Math.max(0, len - straight)
}

function pathScore(
  path: WorldPoint[],
  source: WorldPoint,
  target: WorldPoint,
  centroid: WorldPoint | null,
): number {
  const offSlab = pathInBoundedSlab(path) ? 0 : 10_000_000_000
  return (
    offSlab +
    path.length * 1_000_000_000 +
    pathHopExtent(path) * 10_000 -
    outwardScore(path, source, target, centroid) -
    firstLegDot(path, source, target) * 0.01
  )
}

function pickBest(
  paths: WorldPoint[][],
  source: WorldPoint,
  target: WorldPoint,
  centroid: WorldPoint | null,
): WorldPoint[] | null {
  let best: WorldPoint[] | null = null
  let bestScore = Infinity
  for (const path of paths) {
    const score = pathScore(path, source, target, centroid)
    if (score < bestScore) {
      bestScore = score
      best = path
    }
  }
  return best
}

/** One extra iso hop around a blocked parallelogram (still 8-axis, two elbows). */
function aroundHops(source: WorldPoint, target: WorldPoint): WorldPoint[][] {
  const start = screenToIso(source.x, source.y)
  const goal = screenToIso(target.x, target.y)
  const shifts = [-4, -2, 2, 4]
  const out: WorldPoint[][] = []
  for (const s of shifts) {
    out.push(
      mergeCollinear([
        source,
        isoToScreen(start.i, start.j + s),
        isoToScreen(goal.i, start.j + s),
        target,
      ]),
    )
    out.push(
      mergeCollinear([
        source,
        isoToScreen(start.i + s, start.j),
        isoToScreen(start.i + s, goal.j),
        target,
      ]),
    )
  }
  return out
}

function elbowMids(source: WorldPoint, target: WorldPoint): WorldPoint[] {
  const start = screenToIso(source.x, source.y)
  const goal = screenToIso(target.x, target.y)
  return [
    isoToScreen(start.i, goal.j),
    isoToScreen(goal.i, start.j),
  ]
}

function candidatePaths(source: WorldPoint, target: WorldPoint): WorldPoint[][] {
  if (pointsEqual(source, target)) return [[source]]
  const out: WorldPoint[][] = []
  if (is8AxisSegment(source, target)) {
    out.push([source, target])
  }
  for (const mid of elbowMids(source, target)) {
    if (!is8AxisSegment(source, mid) || !is8AxisSegment(mid, target)) continue
    out.push(mergeCollinear([source, mid, target]))
  }
  out.push(...aroundHops(source, target))
  return out.filter((path, i, arr) => {
    if (!pathValid(path, source, target)) return false
    const key = pathKey(path)
    return arr.findIndex((p) => pathKey(p) === key) === i
  })
}

function routeAvoiding(
  source: WorldPoint,
  target: WorldPoint,
  bystanders: GlyphHitbox[],
  centroid: WorldPoint | null,
): { path: WorldPoint[]; candidates: WorldPoint[][] } {
  const all = candidatePaths(source, target)
  const clear = all.filter(
    (path) => !pathHitsBystanders(path, bystanders) && pathInBoundedSlab(path),
  )
  const inSlab = all.filter((path) => pathInBoundedSlab(path))
  const clearAny = all.filter((path) => !pathHitsBystanders(path, bystanders))
  const path =
    pickBest(clear, source, target, centroid) ??
    pickBest(inSlab, source, target, centroid) ??
    pickBest(clearAny, source, target, centroid) ??
    pickBest(all, source, target, centroid) ??
    [source, target]
  const candidates =
    clear.length > 0
      ? clear
      : inSlab.length > 0
        ? inSlab
        : clearAny.length > 0
          ? clearAny
          : all
  return { path, candidates }
}

function routeOutgoingGroup(
  source: SvgNode,
  edges: ConnectorEdgeRef[],
  nodes: Map<string, SvgNode>,
  allNodes: SvgNode[],
  centroid: WorldPoint | null,
): { routes: Map<string, WorldPoint[]>; candidates: Map<string, WorldPoint[][]> } {
  const routes = new Map<string, WorldPoint[]>()
  const candidates = new Map<string, WorldPoint[][]>()
  const sourceFace = faceCenter(source)

  for (const edge of edges) {
    const target = nodes.get(edge.targetId)
    if (!target) continue
    const targetFace = faceCenter(target)
    const sourcePort = attachPoint(source, targetFace, {
      archetype: source.archetype,
    })
    const targetPort = attachPoint(target, sourceFace, {
      archetype: target.archetype,
    })
    const ignore = new Set([source.id, target.id])
    const bystanders = allNodes
      .filter((n) => !ignore.has(n.id))
      .map(glyphHitbox)
    const routed = routeAvoiding(sourcePort, targetPort, bystanders, centroid)
    routes.set(edge.id, routed.path)
    candidates.set(edge.id, routed.candidates)
  }
  return { routes, candidates }
}

function pairScore(
  ca: WorldPoint[],
  cb: WorldPoint[],
  centroid: WorldPoint | null,
): number {
  return (
    pathScore(ca, ca[0], ca[ca.length - 1], centroid) +
    pathScore(cb, cb[0], cb[cb.length - 1], centroid)
  )
}

function uncrossRoutes(
  edges: ConnectorEdgeRef[],
  routes: Map<string, WorldPoint[]>,
  candidates: Map<string, WorldPoint[][]>,
  centroid: WorldPoint | null,
): void {
  for (let pass = 0; pass < 6; pass++) {
    let changed = false
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const a = edges[i]
        const b = edges[j]
        const pa = routes.get(a.id)
        const pb = routes.get(b.id)
        if (!pa || !pb || !pathsCross(pa, pb)) continue

        const optsA = candidates.get(a.id) ?? [pa]
        const optsB = candidates.get(b.id) ?? [pb]
        let bestA = pa
        let bestB = pb
        let bestScore = Infinity
        let found = false
        for (const ca of optsA) {
          for (const cb of optsB) {
            if (pathsCross(ca, cb)) continue
            const score = pairScore(ca, cb, centroid)
            if (score < bestScore) {
              bestScore = score
              bestA = ca
              bestB = cb
              found = true
            }
          }
        }
        if (
          found &&
          (pathKey(bestA) !== pathKey(pa) || pathKey(bestB) !== pathKey(pb))
        ) {
          routes.set(a.id, bestA)
          routes.set(b.id, bestB)
          changed = true
        }
      }
    }
    if (!changed) break
  }
}

/**
 * Scene-level connector routing: per-edge attach toward the peer, iso elbow
 * on the outside of the cluster, then uncross any pair that still X's.
 */
export function routeConnectorScene(args: {
  nodes: SvgNode[]
  zones: SvgZone[]
  edges: ConnectorEdgeRef[]
}): Map<string, WorldPoint[]> {
  const { nodes, edges } = args
  const byId = nodeById(nodes)
  const routes = new Map<string, WorldPoint[]>()
  const candidates = new Map<string, WorldPoint[][]>()
  const validEdges: ConnectorEdgeRef[] = []

  const outgoing = new Map<string, ConnectorEdgeRef[]>()
  for (const edge of edges) {
    if (!byId.has(edge.sourceId) || !byId.has(edge.targetId)) continue
    validEdges.push(edge)
    const list = outgoing.get(edge.sourceId) ?? []
    list.push(edge)
    outgoing.set(edge.sourceId, list)
  }

  const centroid = sceneCentroid(nodes)

  for (const [sourceId, group] of outgoing) {
    const source = byId.get(sourceId)
    if (!source) continue
    const groupRoutes = routeOutgoingGroup(
      source,
      group.sort((a, b) => a.id.localeCompare(b.id)),
      byId,
      nodes,
      centroid,
    )
    for (const [id, path] of groupRoutes.routes) routes.set(id, path)
    for (const [id, cands] of groupRoutes.candidates) candidates.set(id, cands)
  }

  uncrossRoutes(validEdges, routes, candidates, centroid)
  return routes
}
