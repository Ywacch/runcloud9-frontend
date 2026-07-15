import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'

const PROXY_STRATEGIES = ['write-through', 'write-behind'] as const
export const PROXY_CACHE_STRATEGIES = PROXY_STRATEGIES
const CACHE_ASIDE = 'cache-aside'
const TIMELINE_STORE = 'timeline-store'
const NON_PROXY_STRATEGIES = [CACHE_ASIDE, TIMELINE_STORE] as const
/** Legacy UI value — canonicalized to write-through (backend CanonicalCacheStrategy). */
const LEGACY_READ_THROUGH = 'read-through'

export function isProxyCacheStrategy(strategy: unknown): boolean {
  return (PROXY_STRATEGIES as readonly string[]).includes(String(strategy ?? ''))
}

/** True for selectable proxy strategies plus legacy read-through (pre-normalize canvases). */
export function isProxyOrLegacyCacheStrategy(strategy: unknown): boolean {
  const s = String(strategy ?? '')
  return isProxyCacheStrategy(s) || s === LEGACY_READ_THROUGH
}

export interface CacheStrategyOptions {
  allowProxyStrategies?: boolean
}

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
  options?: CacheStrategyOptions,
): string[] {
  const allowProxy = options?.allowProxyStrategies ?? true
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

  let strategies: string[]
  if (hasDBEdge && !anyConnectorAlsoHasDb) {
    strategies = [...PROXY_STRATEGIES]
  } else if (!hasDBEdge && anyConnectorAlsoHasDb) {
    strategies = [...NON_PROXY_STRATEGIES]
  } else if (!hasDBEdge && !anyConnectorAlsoHasDb) {
    strategies = [...NON_PROXY_STRATEGIES]
  } else {
    return []
  }
  if (!allowProxy) {
    strategies = strategies.filter((s) => !isProxyCacheStrategy(s))
  }
  return strategies
}

export function defaultCacheStrategyForTopology(
  cacheNodeId: string,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): string {
  const available = getAvailableCacheStrategies(cacheNodeId, nodes, edges)
  if (available.includes(TIMELINE_STORE)) return TIMELINE_STORE
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
          'Cache-aside does not use cache→database. Remove this edge or switch to a proxy strategy (write-through / write-behind).'
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
  options?: CacheStrategyOptions,
): Record<string, CanvasNode> {
  const next = { ...nodes }
  let changed = false
  for (const id of Object.keys(next)) {
    const n = next[id]
    if (n?.type !== 'cache') continue
    const avail = getAvailableCacheStrategies(id, next, edges, options)
    const cur = String(n.config.cacheStrategy ?? n.config.strategy ?? CACHE_ASIDE)
    let target = cur === LEGACY_READ_THROUGH ? 'write-through' : cur
    if (avail.length > 0 && !avail.includes(target)) {
      target = avail[0]
    }
    if (target === cur && String(n.config.cacheStrategy ?? '') === target) {
      continue
    }
    const config: Record<string, unknown> = {
      ...n.config,
      cacheStrategy: target,
    }
    // Keep strategy in sync when either key is present (deployPayload wire shape).
    if ('strategy' in n.config || 'cacheStrategy' in n.config) {
      config.strategy = target
    }
    next[id] = { ...n, config }
    changed = true
  }
  return changed ? next : nodes
}
