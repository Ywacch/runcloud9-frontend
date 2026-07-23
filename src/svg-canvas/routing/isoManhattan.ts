import {
  isoToScreen,
  screenToIso,
  snapIso,
  type IsoPoint,
  type WorldPoint,
} from '../math/iso'

const BEND_PENALTY = 2.5
const SEARCH_PAD = 20

type Dir = 'i+' | 'i-' | 'j+' | 'j-' | null

type ANode = {
  i: number
  j: number
  g: number
  f: number
  dir: Dir
  parent: string | null
}

function key(i: number, j: number): string {
  return `${i},${j}`
}

function heuristic(a: IsoPoint, b: IsoPoint): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function neighbors(i: number, j: number): { i: number; j: number; dir: Dir }[] {
  return [
    { i: i + 1, j, dir: 'i+' },
    { i: i - 1, j, dir: 'i-' },
    { i, j: j + 1, dir: 'j+' },
    { i, j: j - 1, dir: 'j-' },
  ]
}

function obstacleSet(anchors: WorldPoint[], walkable: Set<string>): Set<string> {
  const blocked = new Set<string>()
  for (const a of anchors) {
    const c = snapIso(screenToIso(a.x, a.y).i, screenToIso(a.x, a.y).j)
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const k = key(c.i + di, c.j + dj)
        if (!walkable.has(k)) blocked.add(k)
      }
    }
  }
  return blocked
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
    // Same direction (collinear parallel) — skip cur
    if (dx1 * dy2 === dy1 * dx2 && (dx1 !== 0 || dy1 !== 0)) continue
    out.push(cur)
  }
  out.push(points[points.length - 1])
  return out
}

function reconstruct(
  came: Map<string, ANode>,
  endKey: string,
  source: WorldPoint,
  target: WorldPoint,
): WorldPoint[] {
  const lattice: IsoPoint[] = []
  let cur: string | null = endKey
  while (cur) {
    const n = came.get(cur)
    if (!n) break
    lattice.push({ i: n.i, j: n.j })
    cur = n.parent
  }
  lattice.reverse()
  const world = lattice.map((p) => isoToScreen(p.i, p.j))
  if (world.length === 0) return [source, target]
  world[0] = source
  world[world.length - 1] = target
  return mergeCollinear(world)
}

/**
 * Iso-Manhattan A* on half-cell lattice (4-neighbor i/j).
 * Obstacles from node anchors (chebyshev ≤1 in half-steps).
 */
export function routeIsoManhattan(args: {
  source: WorldPoint
  target: WorldPoint
  obstacleAnchors: WorldPoint[]
}): WorldPoint[] {
  const { source, target, obstacleAnchors } = args
  const start = snapIso(screenToIso(source.x, source.y).i, screenToIso(source.x, source.y).j)
  const goal = snapIso(screenToIso(target.x, target.y).i, screenToIso(target.x, target.y).j)

  if (start.i === goal.i && start.j === goal.j) {
    return [source]
  }

  const walkable = new Set([key(start.i, start.j), key(goal.i, goal.j)])
  const blocked = obstacleSet(obstacleAnchors, walkable)

  const minI = Math.min(start.i, goal.i) - SEARCH_PAD
  const maxI = Math.max(start.i, goal.i) + SEARCH_PAD
  const minJ = Math.min(start.j, goal.j) - SEARCH_PAD
  const maxJ = Math.max(start.j, goal.j) + SEARCH_PAD

  const open: ANode[] = []
  const bestG = new Map<string, number>()
  const came = new Map<string, ANode>()

  const startNode: ANode = {
    i: start.i,
    j: start.j,
    g: 0,
    f: heuristic(start, goal),
    dir: null,
    parent: null,
  }
  open.push(startNode)
  bestG.set(key(start.i, start.j), 0)
  came.set(key(start.i, start.j), startNode)

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.g - b.g)
    const current = open.shift()!
    const ck = key(current.i, current.j)
    if (current.i === goal.i && current.j === goal.j) {
      return reconstruct(came, ck, source, target)
    }

    for (const n of neighbors(current.i, current.j)) {
      if (n.i < minI || n.i > maxI || n.j < minJ || n.j > maxJ) continue
      const nk = key(n.i, n.j)
      if (blocked.has(nk)) continue
      const bend = current.dir && current.dir !== n.dir ? BEND_PENALTY : 0
      const g = current.g + 1 + bend
      const prevBest = bestG.get(nk)
      if (prevBest !== undefined && g >= prevBest) continue
      bestG.set(nk, g)
      const node: ANode = {
        i: n.i,
        j: n.j,
        g,
        f: g + heuristic(n, goal),
        dir: n.dir,
        parent: ck,
      }
      came.set(nk, node)
      open.push(node)
    }
  }

  return [source, target]
}
