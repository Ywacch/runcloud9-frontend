import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'

/** Map backend `related` component keys to canvas node ids for highlighting. */
export function nodeIdsForRelatedBackendComponents(
  related: string[] | undefined,
  nodes: Record<string, CanvasNode>
): string[] {
  if (!related?.length) return []
  const want = new Set(
    related.map((r) => String(r).trim()).filter((r) => r.length > 0)
  )
  if (want.size === 0) return []
  return Object.values(nodes)
    .filter((n) => want.has(canvasToBackend[n.type]))
    .map((n) => n.id)
}
