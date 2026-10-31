import type { CanvasNode } from '../editor-core/stores/canvasStore'

export const SOCIAL_FEED_PUSH_TEMPLATE_ID = 'social-feed'

export const SOCIAL_FEED_CACHE_REMOVAL_BANNER =
  'Cache removed. The app reads the feed with JOINs on posts, follows, and users.'

export const SOCIAL_FEED_TIMELINE_ON_DB_BANNER =
  'Cache removed. Postgres stores each timeline entry as its own row.'

function countCacheNodes(nodes: Record<string, CanvasNode>): number {
  return Object.values(nodes).filter((n) => n.type === 'cache').length
}

function timelineBoundToDatabase(
  nodes: Record<string, CanvasNode>,
  jobBindings: Record<string, string> | undefined,
): boolean {
  const nodeId = jobBindings?.timeline?.trim()
  if (!nodeId) return false
  return nodes[nodeId]?.type === 'database'
}

/** One-shot banner when the last cache node is removed on social-feed (push). */
export function socialFeedCacheRemovalBanner(
  templateId: string | null,
  prevNodes: Record<string, CanvasNode>,
  nextNodes: Record<string, CanvasNode>,
  removedNodeId: string,
  jobBindings?: Record<string, string>,
): string | null {
  if (templateId !== SOCIAL_FEED_PUSH_TEMPLATE_ID) return null
  const removed = prevNodes[removedNodeId]
  if (!removed || removed.type !== 'cache') return null
  if (countCacheNodes(prevNodes) !== 1) return null
  if (countCacheNodes(nextNodes) !== 0) return null
  if (timelineBoundToDatabase(nextNodes, jobBindings)) {
    return SOCIAL_FEED_TIMELINE_ON_DB_BANNER
  }
  return SOCIAL_FEED_CACHE_REMOVAL_BANNER
}
