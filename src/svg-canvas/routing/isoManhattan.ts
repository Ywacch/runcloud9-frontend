import {
  isoToScreen,
  screenToIso,
  snapIso,
  type IsoPoint,
  type WorldPoint,
} from '../math/iso'

/** Prefer long straight runs; Cloudcraft almost never zigzags. */
const BEND_PENALTY = 6
const SEARCH_PADS = [4, 12, 24, 48, 80] as const

type Dir =
  | 'i+'
  | 'i-'
  | 'j+'
  | 'j-'
  | 'h+' // screen horizontal right (i+, j-)
  | 'h-' // screen horizontal left  (i-, j+)
  | 'v+' // screen vertical down    (i+, j+)
  | 'v-' // screen vertical up      (i-, j-)
  | null

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

/**
 * Cloudcraft 8-neighbor lattice:
 * - 4 iso axes (i± / j±) → screen diagonals
 * - 4 square moves (i±j∓ / i±j±) → screen horizontal / vertical
 */
function neighbors(
  i: number,
  j: number,
): { i: number; j: number; dir: Dir; cost: number }[] {
  return [
    { i: i + 1, j, dir: 'i+', cost: 1 },
    { i: i - 1, j, dir: 'i-', cost: 1 },
    { i, j: j + 1, dir: 'j+', cost: 1 },
    { i, j: j - 1, dir: 'j-', cost: 1 },
    // Screen H/V — two half-cells of manhattan each.
    { i: i + 1, j: j - 1, dir: 'h+', cost: 2 },
    { i: i - 1, j: j + 1, dir: 'h-', cost: 2 },
    { i: i + 1, j: j + 1, dir: 'v+', cost: 2 },
    { i: i - 1, j: j - 1, dir: 'v-', cost: 2 },
  ]
}

function blockedSet(
  cells: IsoPoint[],
  walkable: Set<string>,
): Set<string> {
  const blocked = new Set<string>()
  for (const c of cells) {
    const k = key(c.i, c.j)
    if (!walkable.has(k)) blocked.add(k)
  }
  return blocked
}

/** Legacy: expand world anchors into a Chebyshev-1 pad (tests / callers). */
export function anchorsToObstacleCells(anchors: WorldPoint[]): IsoPoint[] {
  const out: IsoPoint[] = []
  const seen = new Set<string>()
  for (const a of anchors) {
    const c = snapIso(screenToIso(a.x, a.y).i, screenToIso(a.x, a.y).j)
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const p = { i: c.i + di, j: c.j + dj }
        const k = key(p.i, p.j)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(p)
      }
    }
  }
  return out
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
    // Collinear (including opposite) — drop middle.
    if (Math.abs(dx1 * dy2 - dy1 * dx2) < 1e-6 && (dx1 !== 0 || dy1 !== 0)) {
      continue
    }
    out.push(cur)
  }
  out.push(points[points.length - 1])
  return out
}

/**
 * Open-field iso elbow used by the unused `routeIsoManhattan` helper.
 * Scene routing lives in `routeConnectorScene` (bystander clearance + uncross).
 */
function cloudcraftElbow(
  source: WorldPoint,
  target: WorldPoint,
  _blocked: Set<string>,
): WorldPoint[] | null {
  const start = snapIso(
    screenToIso(source.x, source.y).i,
    screenToIso(source.x, source.y).j,
  )
  const goal = snapIso(
    screenToIso(target.x, target.y).i,
    screenToIso(target.x, target.y).j,
  )

  if (start.i === goal.i && start.j === goal.j) {
    return [source, target]
  }

  // Straight along any of the 8 Cloudcraft axes.
  const di = goal.i - start.i
  const dj = goal.j - start.j
  const straight =
    di === 0 ||
    dj === 0 ||
    Math.abs(di) === Math.abs(dj)
  if (straight) {
    return mergeCollinear([source, target])
  }

  // One elbow: the two iso-lattice corners. connection-ex diagrams run
  // along i then j (diamond), never a long screen-H then screen-V tour.
  // Short H/V appears only as attach stubs, not as the primary run.
  const candidates: IsoPoint[] = [
    { i: start.i, j: goal.j },
    { i: goal.i, j: start.j },
  ]

  const toTargetX = target.x - source.x
  const toTargetY = target.y - source.y
  let best: WorldPoint[] | null = null
  let bestScore = Infinity
  let fallback: WorldPoint[] | null = null
  let fallbackLastDot = -Infinity
  for (const corner of candidates) {
    if (corner.i === start.i && corner.j === start.j) continue
    if (corner.i === goal.i && corner.j === goal.j) continue
    const mid = isoToScreen(corner.i, corner.j)
    const lastDot =
      (target.x - mid.x) * toTargetX + (target.y - mid.y) * toTargetY
    const path = mergeCollinear([source, mid, target])
    if (lastDot > fallbackLastDot) {
      fallbackLastDot = lastDot
      fallback = path
    }
    // Outer parallelogram vertex sits past the target in screen space; the
    // last stub then reverses through empty grid (Postgres overshoot).
    if (lastDot < -1e-6) continue
    const first = path[1] ?? mid
    const dot = (first.x - source.x) * toTargetX + (first.y - source.y) * toTargetY
    // Fewer points, then the first leg that aims at the target (iso parallelogram
    // sides are equal length — do not use Euclidean total, which prefers CAD H/V).
    const score = path.length * 1_000_000 - dot
    if (score < bestScore) {
      bestScore = score
      best = path
    }
  }
  return best ?? fallback
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

function searchPad(
  start: IsoPoint,
  goal: IsoPoint,
  blocked: Set<string>,
  source: WorldPoint,
  target: WorldPoint,
  pad: number,
): WorldPoint[] | null {
  const minI = Math.min(start.i, goal.i) - pad
  const maxI = Math.max(start.i, goal.i) + pad
  const minJ = Math.min(start.j, goal.j) - pad
  const maxJ = Math.max(start.j, goal.j) + pad

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
      const g = current.g + n.cost + bend
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

  return null
}

/**
 * One-elbow iso fallback when A* cannot find a lattice path.
 * Prefer a lattice corner that is not blocked; never invent a free diagonal.
 */
function isoElbowFallback(
  source: WorldPoint,
  target: WorldPoint,
  blocked: Set<string>,
): WorldPoint[] {
  const start = snapIso(
    screenToIso(source.x, source.y).i,
    screenToIso(source.x, source.y).j,
  )
  const goal = snapIso(
    screenToIso(target.x, target.y).i,
    screenToIso(target.x, target.y).j,
  )
  if (start.i === goal.i || start.j === goal.j) {
    return [source, target]
  }

  const corners: IsoPoint[] = [
    { i: start.i, j: goal.j },
    { i: goal.i, j: start.j },
  ]
  const clear = corners.find((c) => !blocked.has(key(c.i, c.j)))
  const corner = clear ?? corners[0]
  const mid = isoToScreen(corner.i, corner.j)
  return mergeCollinear([source, mid, target])
}

/**
 * Cloudcraft-faithful connector routing.
 * Prefer straight / one-elbow geometric paths (8-connected lattice including
 * screen H/V; paints under bystander glyphs). Fall back to bend-penalized A*
 * only when no geometric elbow exists.
 */
export function routeIsoManhattan(args: {
  source: WorldPoint
  target: WorldPoint
  obstacleAnchors?: WorldPoint[]
  obstacleCells?: IsoPoint[]
}): WorldPoint[] {
  const { source, target } = args
  const start = snapIso(
    screenToIso(source.x, source.y).i,
    screenToIso(source.x, source.y).j,
  )
  const goal = snapIso(
    screenToIso(target.x, target.y).i,
    screenToIso(target.x, target.y).j,
  )

  if (start.i === goal.i && start.j === goal.j) {
    return [source]
  }

  const walkable = new Set([key(start.i, start.j), key(goal.i, goal.j)])
  const cells =
    args.obstacleCells ??
    anchorsToObstacleCells(args.obstacleAnchors ?? [])
  const blocked = blockedSet(cells, walkable)

  const clearElbow = cloudcraftElbow(source, target, blocked)
  if (clearElbow && clearElbow.length <= 3) {
    return clearElbow
  }

  for (const pad of SEARCH_PADS) {
    const path = searchPad(start, goal, blocked, source, target, pad)
    if (path) return path
  }

  return isoElbowFallback(source, target, blocked)
}
