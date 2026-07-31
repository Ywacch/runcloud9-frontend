import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'

function semanticOf(node: CanvasNode): string | null {
  const mapped = canvasToBackend[node.type]
  return mapped ?? null
}

function nodeDisplayName(node: CanvasNode): string {
  const label = String(node.label ?? '').trim()
  return label || node.id
}

/**
 * Create-blocking whole-design issues (mirrors ganymede ValidateTopology /
 * AssessTopology presence rules + singleton Deployment names).
 * Returns the first issue, same as BE validate stopping on the first error.
 */
export function assessGraphConstraints(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): string | null {
  let hasCache = false
  let hasDB = false
  let hasMQ = false
  let hasWorker = false
  const appServers: CanvasNode[] = []
  const workers: CanvasNode[] = []

  for (const node of Object.values(nodes)) {
    const semantic = semanticOf(node)
    if (semantic === 'cache') hasCache = true
    if (semantic === 'db') hasDB = true
    if (semantic === 'mq') hasMQ = true
    if (semantic === 'worker') {
      hasWorker = true
      workers.push(node)
    }
    if (semantic === 'app-server') appServers.push(node)
  }

  if (hasCache && !hasDB) {
    return 'A cache node is present but no database — add a database or clarify whether Redis is your primary store.'
  }
  if (hasWorker && !hasMQ) {
    return 'Workers consume from message queues — add a message queue to the design.'
  }
  if (hasMQ && !hasWorker) {
    return 'Message queue has no consumer — add a worker node.'
  }

  if (appServers.length > 1) {
    return (
      `only one app-server node is supported (found ${appServers.length}) — ` +
      'scale with replicas on a single app-server instead of placing multiple nodes'
    )
  }
  if (workers.length > 1) {
    return (
      `only one worker node is supported (found ${workers.length}) — ` +
      'scale with replicas on a single worker instead of placing multiple nodes'
    )
  }

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
      return `worker "${name}" must connect to a db node (add worker -> db edge)`
    }
    if (!hasMQDep) {
      if (hasInboundMQ) {
        return `invalid worker/mq edge direction for worker "${name}": found mq -> worker; use worker -> mq`
      }
      return `worker "${name}" must connect to an mq node (add worker -> mq edge)`
    }
  }

  return null
}
