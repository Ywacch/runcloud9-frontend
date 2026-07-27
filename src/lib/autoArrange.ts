import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { fitStorePositionsToGrid } from '../canvas/utils/positionAdapter'

// SVG host uses the Cloudcraft projector (x=(i-j)·64, y=(i+j)·37). To read
// bottom-left → top-right, dependency layers must advance NE (right + up),
// which is -j / -store.z. Siblings fan along the perpendicular ±i / store.x.
// Keep the compact NE lattice from the Cloudcraft-style reference layout
// (LAYER_STEP 6 / SIBLING_STEP 8). Only add depth when a layer is wide
// enough that the next hop would otherwise choke (message queues).
const LAYER_STEP = 6 // store.z per layer → iso row step of 3 (negated for NE)
const SIBLING_STEP = 8 // store.x per sibling → iso col step of 4
const WIDE_LAYER_EXTRA_STEP = 4
const UPSTREAM_TYPES: Partial<Record<CanvasNode['type'], CanvasNode['type']>> = {
  worker: 'message_queue',
}

function centerSpread(index: number, count: number): number {
  if (count <= 1) return 0
  const mid = (count - 1) / 2
  return Math.round((index - mid) * SIBLING_STEP)
}

function layerNeedsExtraGap(nodes: CanvasNode[]): boolean {
  return nodes.some((node) => node.type === 'message_queue')
}

function computeDependencyLayers(nodes: CanvasNode[], edges: CanvasEdge[]): Map<string, number> {
  const nodeIds = nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b))
  const knownIds = new Set(nodeIds)
  const outById = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  const layers = new Map<string, number>()

  for (const id of nodeIds) {
    outById.set(id, [])
    inDegree.set(id, 0)
    layers.set(id, 0)
  }

  for (const e of edges) {
    if (!knownIds.has(e.sourceId) || !knownIds.has(e.targetId)) continue
    outById.get(e.sourceId)?.push(e.targetId)
    inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1)
  }

  for (const id of nodeIds) {
    const neighbors = outById.get(id)
    if (!neighbors) continue
    neighbors.sort((a, b) => a.localeCompare(b))
  }

  // Kahn traversal over flow direction: source -> target.
  const queue = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0)
  let cursor = 0
  const processed = new Set<string>()
  while (cursor < queue.length) {
    const id = queue[cursor++]
    processed.add(id)
    const baseLayer = layers.get(id) ?? 0
    for (const targetId of outById.get(id) ?? []) {
      layers.set(targetId, Math.max(layers.get(targetId) ?? 0, baseLayer + 1))
      const nextInDegree = (inDegree.get(targetId) ?? 0) - 1
      inDegree.set(targetId, nextInDegree)
      if (nextInDegree === 0) queue.push(targetId)
    }
  }

  // Cycle-safe fallback: any remaining nodes are part of a cycle.
  for (const id of nodeIds) {
    if (!processed.has(id)) layers.set(id, 0)
  }

  return layers
}

export function autoArrangeByDependencyLayers(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Record<string, [number, number, number]> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const layoutEdges = edges.map((e) => {
    const src = nodeById.get(e.sourceId)
    const tgt = nodeById.get(e.targetId)
    if (!src || !tgt) return e
    if (UPSTREAM_TYPES[src.type] === tgt.type) {
      return { ...e, sourceId: e.targetId, targetId: e.sourceId }
    }
    return e
  })

  const layers = computeDependencyLayers(nodes, layoutEdges)
  const neighborsById = new Map<string, Set<string>>()
  for (const node of nodes) neighborsById.set(node.id, new Set<string>())
  for (const edge of layoutEdges) {
    if (!neighborsById.has(edge.sourceId) || !neighborsById.has(edge.targetId)) continue
    neighborsById.get(edge.sourceId)?.add(edge.targetId)
    neighborsById.get(edge.targetId)?.add(edge.sourceId)
  }
  const layerBuckets = new Map<number, CanvasNode[]>()
  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0
    if (!layerBuckets.has(layer)) layerBuckets.set(layer, [])
    layerBuckets.get(layer)?.push(node)
  }

  const positions: Record<string, [number, number, number]> = {}
  const orderedLayers = [...layerBuckets.keys()].sort((a, b) => a - b)
  const layerDepth = new Map<number, number>()
  let depth = 0
  let previousLayer: number | null = null
  for (const layer of orderedLayers) {
    if (previousLayer != null) {
      depth += (layer - previousLayer) * LAYER_STEP
      if (layerNeedsExtraGap(layerBuckets.get(previousLayer) ?? [])) {
        depth += WIDE_LAYER_EXTRA_STEP
      }
    }
    layerDepth.set(layer, depth)
    previousLayer = layer

    const barycenterFor = (node: CanvasNode): number | null => {
      const neighbors = neighborsById.get(node.id)
      if (!neighbors || neighbors.size === 0) return null
      let sum = 0
      let count = 0
      for (const neighborId of neighbors) {
        if ((layers.get(neighborId) ?? 0) !== layer - 1) continue
        const neighborPos = positions[neighborId]
        if (!neighborPos) continue
        // Siblings spread on store.x now, so order against the same axis.
        sum += neighborPos[0]
        count += 1
      }
      if (count === 0) return null
      return sum / count
    }
    const bucket = [...(layerBuckets.get(layer) ?? [])].sort((a, b) => {
      const aBary = barycenterFor(a)
      const bBary = barycenterFor(b)
      if (aBary == null && bBary == null) return a.id.localeCompare(b.id)
      if (aBary == null) return 1
      if (bBary == null) return -1
      if (aBary !== bBary) return aBary - bBary
      return a.id.localeCompare(b.id)
    })
    for (let i = 0; i < bucket.length; i++) {
      const n = bucket[i]
      // Layer advances NE via -store.z; siblings fan on store.x.
      positions[n.id] = [
        centerSpread(i, bucket.length),
        n.position[1],
        -(layerDepth.get(layer) ?? 0),
      ]
    }
  }

  fitStorePositionsToGrid(positions)

  return positions
}
