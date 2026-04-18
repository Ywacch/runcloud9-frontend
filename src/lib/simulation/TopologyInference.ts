import type { CanvasEdge, CanvasNode } from '../../store/canvasStore'

export type EdgeSemantics =
  | 'absorb-on-hit'
  | 'cache-miss-forward'
  | 'load-distribute'
  | 'async-decouple'
  | 'passthrough-compute'

function hasDownstreamDatabase(
  cacheId: string,
  edges: CanvasEdge[],
  nodeById: Map<string, CanvasNode>
): boolean {
  for (const e of edges) {
    if (e.sourceId !== cacheId) continue
    const t = nodeById.get(e.targetId)
    if (t?.type === 'database') return true
  }
  return false
}

/**
 * Returns true when a node fans out to both a cache sibling and a database
 * sibling in the parallel cache-aside pattern (source → cache AND source → db).
 * In that layout the source→db edge should only carry cache-miss traffic.
 */
function hasCacheSibling(
  sourceId: string,
  targetId: string,
  edges: CanvasEdge[],
  nodeById: Map<string, CanvasNode>
): boolean {
  const target = nodeById.get(targetId)
  if (target?.type !== 'database') return false
  for (const e of edges) {
    if (e.sourceId !== sourceId || e.targetId === targetId) continue
    const t = nodeById.get(e.targetId)
    if (t?.type === 'cache') return true
  }
  return false
}

export function classifyEdges(
  nodes: CanvasNode[],
  connections: CanvasEdge[]
): Map<string, EdgeSemantics> {
  const semanticsMap = new Map<string, EdgeSemantics>()
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  for (const conn of connections) {
    const source = nodeById.get(conn.sourceId)
    const target = nodeById.get(conn.targetId)
    if (!source || !target) {
      semanticsMap.set(conn.id, 'passthrough-compute')
      continue
    }

    // Parallel cache-aside: source fans out to both a cache and a database.
    // The cache edge absorbs hits; the database edge only carries misses.
    if (hasCacheSibling(conn.sourceId, conn.targetId, connections, nodeById)) {
      semanticsMap.set(conn.id, 'cache-miss-forward')
      continue
    }

    if (
      target.type === 'cache' &&
      hasDownstreamDatabase(target.id, connections, nodeById)
    ) {
      semanticsMap.set(conn.id, 'absorb-on-hit')
      continue
    }

    if (source.type === 'load_balancer') {
      semanticsMap.set(conn.id, 'load-distribute')
      continue
    }

    if (source.type === 'message_queue' || target.type === 'message_queue') {
      semanticsMap.set(conn.id, 'async-decouple')
      continue
    }

    semanticsMap.set(conn.id, 'passthrough-compute')
  }

  return semanticsMap
}
