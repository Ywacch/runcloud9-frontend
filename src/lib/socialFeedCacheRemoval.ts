import type { CanvasNode } from '../editor-core/stores/canvasStore'

export const SOCIAL_FEED_PUSH_TEMPLATE_ID = 'social-feed'

export const SOCIAL_FEED_CACHE_REMOVAL_BANNER =
  'Cache removed. The feed will read via database JOINs instead of Redis timeline keys.'

function countCacheNodes(nodes: Record<string, CanvasNode>): number {
  return Object.values(nodes).filter((n) => n.type === 'cache').length
}

/** One-shot banner when the last cache node is removed on social-feed (push). */
export function socialFeedCacheRemovalBanner(
  templateId: string | null,
  prevNodes: Record<string, CanvasNode>,
  nextNodes: Record<string, CanvasNode>,
  removedNodeId: string,
): string | null {
  if (templateId !== SOCIAL_FEED_PUSH_TEMPLATE_ID) return null
  const removed = prevNodes[removedNodeId]
  if (!removed || removed.type !== 'cache') return null
  if (countCacheNodes(prevNodes) !== 1) return null
  if (countCacheNodes(nextNodes) !== 0) return null
  return SOCIAL_FEED_CACHE_REMOVAL_BANNER
}
