import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'
import { resolvedJobNodeIds } from './engines/jobsPanelModel'
import { getTopologyRulesCached } from './topologyRulesStore'
import { formatTopologyMessage } from './topologyRulesTypes'

function semanticOf(node: CanvasNode): string | null {
  const mapped = canvasToBackend[node.type]
  return mapped ?? null
}

function nodeDisplayName(node: CanvasNode): string {
  const label = String(node.label ?? '').trim()
  return label || node.id
}

function presenceMessage(id: string): string | undefined {
  return getTopologyRulesCached().presence.find((p) => p.id === id)?.message
}

function workerOutboundMessages() {
  return getTopologyRulesCached().requiredOutbound.find(
    (r) => r.nodeType === 'worker',
  )
}

export function allowsSplitQueueCaches(
  nodes: Record<string, CanvasNode>,
  jobBindings?: Record<string, string> | null,
  templateId?: string | null,
): boolean {
  const caches = Object.values(nodes).filter((n) => semanticOf(n) === 'cache')
  if (caches.length !== 2) return false
  const resolved = resolvedJobNodeIds(
    templateId,
    Object.values(nodes),
    jobBindings,
  )
  const queueID = resolved.work_queue?.trim()
  if (!queueID) return false
  const queueNode = nodeById(nodes, queueID)
  if (!queueNode || semanticOf(queueNode) !== 'cache') return false
  const queueEng = String(
    queueNode.config.cacheEngine ?? queueNode.config.engine ?? 'redis',
  )
    .trim()
    .toLowerCase()
  if (queueEng !== 'redis') return false
  for (const key of ['timeline', 'hot_cache'] as const) {
    const id = resolved[key]?.trim()
    if (!id || id === queueID) continue
    const dataNode = nodeById(nodes, id)
    if (dataNode && semanticOf(dataNode) === 'cache') return true
  }
  return false
}

function nodeById(
  nodes: Record<string, CanvasNode>,
  id: string,
): CanvasNode | undefined {
  const direct = nodes[id]
  if (direct?.id === id) return direct
  return Object.values(nodes).find((n) => n.id === id)
}

function workQueueCacheId(
  nodes: Record<string, CanvasNode>,
  jobBindings?: Record<string, string> | null,
  templateId?: string | null,
): string | null {
  const resolved = resolvedJobNodeIds(
    templateId,
    Object.values(nodes),
    jobBindings,
  )
  const id = (resolved.work_queue ?? jobBindings?.work_queue)?.trim()
  if (!id) return null
  const node = nodeById(nodes, id)
  if (!node || semanticOf(node) !== 'cache') return null
  return id
}

/**
 * Create-blocking whole-design issues (mirrors ganymede ValidateTopology /
 * AssessTopology presence rules + platform singletons).
 * Messages come from GET /meta/topology-rules (fallback until loaded).
 * Returns the first issue, same as BE validate stopping on the first error.
 *
 * jobBindings lets a Redis-hosted work_queue stand in for an mq node.
 */
export function assessGraphConstraints(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  jobBindings?: Record<string, string> | null,
  templateId?: string | null,
): string | null {
  let hasApp = false
  let hasCache = false
  let hasDB = false
  let hasMQ = false
  let hasWorker = false
  let hasLB = false
  const workers: CanvasNode[] = []
  const counts = new Map<string, number>()

  for (const node of Object.values(nodes)) {
    const semantic = semanticOf(node)
    if (!semantic) continue
    counts.set(semantic, (counts.get(semantic) ?? 0) + 1)
    if (semantic === 'app-server') hasApp = true
    if (semantic === 'cache') hasCache = true
    if (semantic === 'db') hasDB = true
    if (semantic === 'mq') hasMQ = true
    if (semantic === 'lb') hasLB = true
    if (semantic === 'worker') {
      hasWorker = true
      workers.push(node)
    }
  }

  const hasAnyComponent =
    hasApp || hasCache || hasDB || hasMQ || hasWorker || hasLB
  // Empty canvas: no nag. Incomplete graph (e.g. db-only): require App Server.
  if (hasAnyComponent && !hasApp) {
    return presenceMessage('missing_app_server') ?? null
  }
  if (hasCache && !hasDB) {
    return presenceMessage('cache_without_db') ?? null
  }
  const queueCacheId = workQueueCacheId(nodes, jobBindings, templateId)
  if (hasWorker && !hasMQ && !queueCacheId) {
    return presenceMessage('worker_without_mq') ?? null
  }
  if (hasMQ && !hasWorker) {
    return presenceMessage('mq_without_worker') ?? null
  }

  for (const rule of getTopologyRulesCached().singletons) {
    if (
      rule.nodeType === 'cache' &&
      allowsSplitQueueCaches(nodes, jobBindings, templateId)
    ) {
      continue
    }
    const count = counts.get(rule.nodeType) ?? 0
    if (count > 1) {
      return formatTopologyMessage(rule.message, { count: String(count) })
    }
  }

  const outbound = workerOutboundMessages()
  const edgeList = Object.values(edges)
  for (const workerNode of workers) {
    let hasDBDep = false
    let hasMQDep = false
    let hasInboundMQ = false
    for (const conn of edgeList) {
      if (conn.sourceId === workerNode.id) {
        const target = nodes[conn.targetId]
        const t = target ? semanticOf(target) : null
        if (t === 'db') hasDBDep = true
        if (t === 'mq') hasMQDep = true
        if (queueCacheId && conn.targetId === queueCacheId && t === 'cache') {
          hasMQDep = true
        }
      }
      if (conn.targetId === workerNode.id) {
        const src = nodes[conn.sourceId]
        const s = src ? semanticOf(src) : null
        if (s === 'mq') hasInboundMQ = true
      }
    }
    const name = nodeDisplayName(workerNode)
    if (!hasDBDep) {
      return outbound
        ? formatTopologyMessage(outbound.missingDbMessage, { name })
        : `worker "${name}" must connect to a db node (add worker -> db edge)`
    }
    if (!hasMQDep) {
      if (hasInboundMQ) {
        return outbound
          ? formatTopologyMessage(outbound.wrongMqDirectionMessage, { name })
          : `invalid worker/mq edge direction for worker "${name}": found mq -> worker; use worker -> mq`
      }
      if (queueCacheId) {
        const tmpl =
          outbound?.missingQueueCacheMessage ||
          'worker "{name}" must connect to the cache that hosts the work queue (add worker -> cache edge)'
        return formatTopologyMessage(tmpl, { name })
      }
      return outbound
        ? formatTopologyMessage(outbound.missingMqMessage, { name })
        : `worker "${name}" must connect to an mq node (add worker -> mq edge)`
    }
  }

  return null
}
