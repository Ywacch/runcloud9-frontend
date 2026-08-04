import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'
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

/**
 * Create-blocking whole-design issues (mirrors ganymede ValidateTopology /
 * AssessTopology presence rules + platform singletons).
 * Messages come from GET /meta/topology-rules (fallback until loaded).
 * Returns the first issue, same as BE validate stopping on the first error.
 */
export function assessGraphConstraints(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): string | null {
  let hasApp = false
  let hasCache = false
  let hasDB = false
  let hasMQ = false
  let hasWorker = false
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
    if (semantic === 'worker') {
      hasWorker = true
      workers.push(node)
    }
  }

  if (!hasApp) {
    return presenceMessage('missing_app_server') ?? null
  }
  if (hasCache && !hasDB) {
    return presenceMessage('cache_without_db') ?? null
  }
  if (hasWorker && !hasMQ) {
    return presenceMessage('worker_without_mq') ?? null
  }
  if (hasMQ && !hasWorker) {
    return presenceMessage('mq_without_worker') ?? null
  }

  for (const rule of getTopologyRulesCached().singletons) {
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
      return outbound
        ? formatTopologyMessage(outbound.missingMqMessage, { name })
        : `worker "${name}" must connect to an mq node (add worker -> mq edge)`
    }
  }

  return null
}
