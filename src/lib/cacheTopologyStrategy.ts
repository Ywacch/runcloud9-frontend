import type { CanvasEdge, CanvasNode } from '../store/canvasStore'

const PROXY_STRATEGIES = ['write-through', 'write-behind', 'read-through'] as const
const CACHE_ASIDE = 'cache-aside'

function edgeList(edges: Record<string, CanvasEdge>): CanvasEdge[] {
  return Object.values(edges)
}

function isConnectorType(t: CanvasNode['type'] | undefined): boolean {
  return t === 'compute' || t === 'worker'
}

/**
 * Cache strategies valid for the current wiring around this cache node.
 * Empty means topology is ambiguous / backend will reject — user should fix edges first.
 */
export function getAvailableCacheStrategies(
  cacheNodeId: string,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): string[] {
  const list = edgeList(edges)
  const hasDBEdge = list.some(
    (e) =>
      e.sourceId === cacheNodeId && nodes[e.targetId]?.type === 'database',
  )
  const connectorIds = new Set<string>()
  for (const e of list) {
    if (e.targetId !== cacheNodeId) continue
    const src = nodes[e.sourceId]
    if (isConnectorType(src?.type)) connectorIds.add(e.sourceId)
  }
  const anyConnectorAlsoHasDb = [...connectorIds].some((appId) =>
    list.some(
      (e) =>
        e.sourceId === appId && nodes[e.targetId]?.type === 'database',
    ),
  )

  if (hasDBEdge && !anyConnectorAlsoHasDb) {
    return [...PROXY_STRATEGIES]
  }
  if (!hasDBEdge && anyConnectorAlsoHasDb) {
    return [CACHE_ASIDE]
  }
  if (!hasDBEdge && !anyConnectorAlsoHasDb) {
    return [CACHE_ASIDE]
  }
  return []
}

export function defaultCacheStrategyForTopology(
  cacheNodeId: string,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): string {
  const available = getAvailableCacheStrategies(cacheNodeId, nodes, edges)
  return available[0] ?? CACHE_ASIDE
}

/**
 * Edge id → warning for canvas highlighting (UX mirror of backend ValidateTopology).
 */
export function getCacheTopologyEdgeIssues(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): Record<string, string> {
  const list = edgeList(edges)
  const issues: Record<string, string> = {}

  for (const e of list) {
    const src = nodes[e.sourceId]
    const tgt = nodes[e.targetId]
    if (src?.type === 'cache' && tgt?.type === 'database') {
      const strat = String(src.config.cacheStrategy ?? CACHE_ASIDE)
      if (strat === CACHE_ASIDE) {
        issues[e.id] =
          'Cache-aside does not use cache→database. Remove this edge or switch to a proxy strategy (write-through / write-behind / read-through).'
      }
    }
  }

  for (const e of list) {
    const src = nodes[e.sourceId]
    const tgt = nodes[e.targetId]
    if (!isConnectorType(src?.type) || tgt?.type !== 'database') continue
    const appId = e.sourceId
    const cachesFromApp = list
      .filter(
        (x) =>
          x.sourceId === appId && nodes[x.targetId]?.type === 'cache',
      )
      .map((x) => x.targetId)
    for (const cid of cachesFromApp) {
      const cacheReachesDb = list.some(
        (x) =>
          x.sourceId === cid && nodes[x.targetId]?.type === 'database',
      )
      if (cacheReachesDb) {
        issues[e.id] =
          'Ambiguous data path: this app also reaches the database through a cache that connects to the database. Remove app→database or rewire the cache path.'
        break
      }
    }
  }

  return issues
}

/** After edge (or graph) changes, snap cache strategies to the closest valid option. */
export function applyCacheStrategyNormalizationToNodes(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): Record<string, CanvasNode> {
  const next = { ...nodes }
  let changed = false
  for (const id of Object.keys(next)) {
    const n = next[id]
    if (n?.type !== 'cache') continue
    const avail = getAvailableCacheStrategies(id, next, edges)
    const cur = String(n.config.cacheStrategy ?? CACHE_ASIDE)
    if (avail.length > 0 && !avail.includes(cur)) {
      next[id] = {
        ...n,
        config: { ...n.config, cacheStrategy: avail[0] },
      }
      changed = true
    }
  }
  return changed ? next : nodes
}
