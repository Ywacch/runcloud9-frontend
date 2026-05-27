import type { CanvasNode } from '../editor-core/stores/canvasStore'

/** Matches backend `cacheServiceHTTPPort` — HTTP sidecar on 8081 vs Redis wire on 6379. */
const HTTP_CACHE_STRATEGIES = new Set([
  'write-through',
  'write-behind',
  'read-through',
])

export function cacheHasBrowserHttpProxy(
  nodes: Record<string, CanvasNode>
): boolean {
  for (const n of Object.values(nodes)) {
    if (n.type !== 'cache') continue
    const cfg = n.config as Record<string, unknown>
    const s = String(cfg.cacheStrategy ?? cfg.strategy ?? 'cache-aside')
    if (HTTP_CACHE_STRATEGIES.has(s)) return true
  }
  return false
}
