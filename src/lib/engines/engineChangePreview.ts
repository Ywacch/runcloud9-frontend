import type {
  CanvasEdge,
  CanvasNode,
  CanvasSnapshot,
} from '../../editor-core/stores/canvasStore'
import { defaultConfigForType } from '../nodeFactory'
import { configPatchForEngine } from '../../svg-canvas/bridge/canvasSvgAdapter'
import { buildJobsPanelModel } from './jobsPanelModel'

export interface EngineChangeCreateNode {
  type: CanvasNode['type']
  engine: string
  /** When set, edges move off this node and it may be removed after the new node exists. */
  replaceNodeId?: string
  /** When set without replaceNodeId, only offsets the new node’s position. */
  positionNearNodeId?: string
  /** Redis maxmemory-policy for a new cache node (work-queue split). */
  evictionPolicy?: string
}

export type WorkQueueRedisMode = 'share' | 'separate'

export interface EngineChangePreview {
  jobId: string
  engine: string
  /** Nodes that would disappear if this engine is chosen. */
  removeNodeIds: string[]
  /** Job binds to this existing node (consolidation). */
  bindToNodeId: string | null
  /** Engine patch stays on this node (in-place swap). */
  patchNodeId: string | null
  /** Host node does not exist yet. Caller adds it, then retargets edges. */
  createNode: EngineChangeCreateNode | null
  summary: string
}

export interface EngineCanvasOps {
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  addNode: (node: CanvasNode) => void
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void
  updateNodeLabel?: (id: string, label: string) => void
  setJobBinding: (job: string, nodeId: string | null) => void
  removeNode: (id: string) => void
  addEdge: (edge: CanvasEdge) => void
  removeEdge: (id: string) => void
}

function canvasTypeForEngine(engine: string): CanvasNode['type'] | null {
  switch (engine) {
    case 'postgresql':
    case 'mysql':
      return 'database'
    case 'redis':
    case 'memcached':
    case 'valkey':
      return 'cache'
    case 'rabbitmq':
      return 'message_queue'
    default:
      return null
  }
}

function nodeLabel(nodes: CanvasNode[], id: string | null): string {
  if (!id) return 'another node'
  return nodes.find((n) => n.id === id)?.label ?? id
}

const STOCK_NODE_LABELS = new Set([
  'Cache',
  'Redis',
  'Memcached',
  'Valkey',
  'PostgreSQL',
  'Message Queue',
])

function renameStockLabel(
  ops: EngineCanvasOps,
  node: CanvasNode,
  engine: string,
): void {
  if (!ops.updateNodeLabel) return
  if (!STOCK_NODE_LABELS.has(node.label)) return
  const next = labelForNewNode(engine)
  if (!next || next === node.label) return
  ops.updateNodeLabel(node.id, next)
}

/** When the label is still a default engine name, return the name for the current engine. */
export function alignedStockLabel(node: CanvasNode): string | null {
  if (node.type !== 'cache' && node.type !== 'database' && node.type !== 'message_queue') {
    return null
  }
  const engine = String(node.config.cacheEngine ?? node.config.engine ?? '').trim().toLowerCase()
  if (!engine) return null
  if (!STOCK_NODE_LABELS.has(node.label)) return null
  const next = labelForNewNode(engine)
  if (!next || next === node.label || !STOCK_NODE_LABELS.has(next)) return null
  return next
}

function inPlaceEngineSummary(node: CanvasNode, engine: string): string {
  const next = labelForNewNode(engine)
  const current = String(node.config.cacheEngine ?? node.config.engine ?? '')
    .trim()
    .toLowerCase()
  if (current === engine) return `Stays on ${next}`
  return `Switch to ${next}`
}

function cacheEngine(node: CanvasNode): string {
  const raw = String(node.config.cacheEngine ?? node.config.engine ?? '')
    .trim()
    .toLowerCase()
  // Stock timeline caches omit the engine. Deploy treats that as Redis.
  if (!raw && node.type === 'cache') return 'redis'
  return raw
}

function dataCacheJobRow(rows: ReturnType<typeof buildJobsPanelModel>) {
  return rows.find((r) => r.jobId === 'timeline' || r.jobId === 'hot_cache')
}

/** True when work_queue can share the timeline or hot-cache Redis node. */
export function canShareWorkQueueRedis(snapshot: CanvasSnapshot): boolean {
  const rows = buildJobsPanelModel(snapshot, null)
  const data = dataCacheJobRow(rows)
  if (!data?.nodeId) return false
  const node = snapshot.nodes.find((n) => n.id === data.nodeId)
  if (!node || node.type !== 'cache') return false
  return cacheEngine(node) === 'redis'
}

/**
 * Preview moving work_queue onto Redis Streams (share vs separate layout).
 */
export function previewWorkQueueRedis(
  snapshot: CanvasSnapshot,
  mode: WorkQueueRedisMode,
): EngineChangePreview {
  const jobId = 'work_queue'
  const eng = 'redis'
  const nodes = snapshot.nodes
  const rows = buildJobsPanelModel(snapshot, null)
  const row = rows.find((r) => r.jobId === jobId)
  const currentId = row?.nodeId ?? null
  const current = currentId ? nodes.find((n) => n.id === currentId) : undefined
  const dataRow = dataCacheJobRow(rows)
  const dataCacheId = dataRow?.nodeId ?? null

  const mqNode = nodes.find((n) => n.type === 'message_queue') ?? null
  const removeMqIfIdle = (keepNodeId: string | null): string[] => {
    if (!mqNode || mqNode.id === keepNodeId) return []
    const othersOnMq = rows.filter(
      (r) => r.jobId !== jobId && r.nodeId === mqNode.id,
    )
    return othersOnMq.length === 0 ? [mqNode.id] : []
  }

  if (mode === 'share') {
    if (!dataCacheId) {
      return {
        jobId,
        engine: eng,
        removeNodeIds: [],
        bindToNodeId: null,
        patchNodeId: null,
        createNode: null,
        summary: 'No Redis cache hosts timeline or hot cache',
      }
    }
    const host = nodes.find((n) => n.id === dataCacheId)
    if (!host || host.type !== 'cache' || cacheEngine(host) !== 'redis') {
      return {
        jobId,
        engine: eng,
        removeNodeIds: [],
        bindToNodeId: null,
        patchNodeId: null,
        createNode: null,
        summary: 'Share requires a Redis timeline or hot-cache node',
      }
    }
    return {
      jobId,
      engine: eng,
      removeNodeIds: removeMqIfIdle(dataCacheId),
      bindToNodeId: dataCacheId,
      patchNodeId: null,
      createNode: null,
      summary: `${row?.jobLabel ?? jobId} shares ${host.label} with ${dataRow?.jobLabel ?? 'data'}.`,
    }
  }

  // Already a Redis that is not the timeline / hot-cache node: stay there.
  if (
    current &&
    current.type === 'cache' &&
    cacheEngine(current) === 'redis' &&
    current.id !== dataCacheId
  ) {
    return {
      jobId,
      engine: eng,
      removeNodeIds: removeMqIfIdle(current.id),
      bindToNodeId: null,
      patchNodeId: current.id,
      createNode: null,
      summary: `Stays on ${current.label}`,
    }
  }

  const dedicated = nodes.find(
    (n) =>
      n.type === 'cache' &&
      n.id !== dataCacheId &&
      cacheEngine(n) === 'redis',
  )
  if (dedicated) {
    return {
      jobId,
      engine: eng,
      removeNodeIds: removeMqIfIdle(dedicated.id),
      bindToNodeId: dedicated.id,
      patchNodeId: null,
      createNode: null,
      summary: `${row?.jobLabel ?? jobId} stays on ${dedicated.label}.`,
    }
  }

  // separate: second Redis for the queue, or a lone queue Redis when there is no data cache.
  const mqReplace =
    current?.type === 'message_queue'
      ? current.id
      : mqNode && rows.find((r) => r.jobId === jobId)?.nodeId === mqNode.id
        ? mqNode.id
        : mqNode?.id ?? null

  if (mqReplace && nodes.find((n) => n.id === mqReplace)) {
    const replace = nodes.find((n) => n.id === mqReplace)!
    const othersOnReplace = rows.filter(
      (r) => r.jobId !== jobId && r.nodeId === replace.id,
    )
    const remove =
      replace.type === 'message_queue' && othersOnReplace.length === 0
        ? [replace.id]
        : []
    return {
      jobId,
      engine: eng,
      removeNodeIds: remove,
      bindToNodeId: null,
      patchNodeId: null,
      createNode: {
        type: 'cache',
        engine: eng,
        replaceNodeId: replace.id,
        evictionPolicy: 'noeviction',
      },
      summary: dataCacheId
        ? `${row?.jobLabel ?? jobId} gets its own Redis (noeviction); ${dataRow?.jobLabel ?? 'data'} stays on ${nodeLabel(nodes, dataCacheId)}.`
        : `Adds Redis for ${row?.jobLabel ?? jobId} and removes ${replace.label}.`,
    }
  }

  const anchor = dataCacheId ?? currentId
  if (!anchor || !nodes.find((n) => n.id === anchor)) {
    return {
      jobId,
      engine: eng,
      removeNodeIds: [],
      bindToNodeId: null,
      patchNodeId: null,
      createNode: null,
      summary: 'No node to anchor a queue Redis',
    }
  }

  return {
    jobId,
    engine: eng,
    removeNodeIds: [],
    bindToNodeId: null,
    patchNodeId: null,
    createNode: {
      type: 'cache',
      engine: eng,
      positionNearNodeId: anchor,
      evictionPolicy: 'noeviction',
    },
    summary: `${row?.jobLabel ?? jobId} gets its own Redis (noeviction); ${dataRow?.jobLabel ?? 'data'} stays on ${nodeLabel(nodes, dataCacheId)}.`,
  }
}

function labelForNewNode(engine: string): string {
  switch (engine) {
    case 'redis':
      return 'Redis'
    case 'memcached':
      return 'Memcached'
    case 'rabbitmq':
      return 'Message Queue'
    case 'postgresql':
      return 'PostgreSQL'
    default:
      return engine
  }
}

/**
 * What the canvas would look like if `jobId` ran on `engine`.
 * In-place swaps only change the current node. Cross-type engines
 * (timeline on Postgres) bind onto an existing node and drop the old one
 * when nothing else uses it. If that host node is missing, the preview
 * asks the caller to add one and move edges off the node being removed.
 */
export function previewJobEngineChange(
  snapshot: CanvasSnapshot,
  jobId: string,
  engine: string,
): EngineChangePreview {
  const nodes = snapshot.nodes
  const rows = buildJobsPanelModel(snapshot, null)
  const row = rows.find((r) => r.jobId === jobId)
  const currentId = row?.nodeId ?? null
  const current = currentId ? nodes.find((n) => n.id === currentId) : undefined
  const targetType = canvasTypeForEngine(engine)
  const eng = engine.trim().toLowerCase()

  if (jobId === 'work_queue' && eng === 'redis') {
    return previewWorkQueueRedis(
      snapshot,
      canShareWorkQueueRedis(snapshot) ? 'share' : 'separate',
    )
  }

  const empty: EngineChangePreview = {
    jobId,
    engine: eng,
    removeNodeIds: [],
    bindToNodeId: null,
    patchNodeId: currentId,
    createNode: null,
    summary: `${row?.jobLabel ?? jobId} stays on ${nodeLabel(nodes, currentId)}`,
  }

  if (!current || !targetType) return empty

  if (current.type === targetType) {
    return {
      ...empty,
      patchNodeId: current.id,
      bindToNodeId: null,
      summary: inPlaceEngineSummary(current, eng),
    }
  }

  const host =
    nodes.find((n) => n.type === targetType && n.id !== current.id) ?? null
  const othersOnCurrent = rows.filter(
    (r) => r.jobId !== jobId && r.nodeId === current.id,
  )

  if (!host) {
    if (othersOnCurrent.length > 0) {
      return {
        ...empty,
        patchNodeId: null,
        summary: `No ${targetType.replace('_', ' ')} node to host ${eng}`,
      }
    }
    return {
      jobId,
      engine: eng,
      removeNodeIds: [current.id],
      bindToNodeId: null,
      patchNodeId: null,
      createNode: {
        type: targetType,
        engine: eng,
        replaceNodeId: current.id,
      },
      summary: `Adds ${labelForNewNode(eng)} and removes ${current.label}.`,
    }
  }

  const remove = othersOnCurrent.length === 0 ? [current.id] : []

  return {
    jobId,
    engine: eng,
    removeNodeIds: remove,
    bindToNodeId: host.id,
    patchNodeId: null,
    createNode: null,
    summary: remove.length
      ? `${row?.jobLabel ?? jobId} moves onto ${host.label}. ${current.label} is removed.`
      : `${row?.jobLabel ?? jobId} moves onto ${host.label}.`,
  }
}

function configForCreatedNode(
  type: CanvasNode['type'],
  engine: string,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    ...defaultConfigForType(type),
    ...configPatchForEngine(type, engine),
  }
  if (type === 'cache') {
    config.cacheStrategy = 'cache-aside'
    config.strategy = 'cache-aside'
  }
  return config
}

function configForPreviewCreateNode(
  create: EngineChangeCreateNode,
): Record<string, unknown> {
  const config = configForCreatedNode(create.type, create.engine)
  if (create.evictionPolicy) {
    config.evictionPolicy = create.evictionPolicy
  }
  return config
}

/**
 * Applies a preview to the canvas. A missing host node is created first.
 * Edges move off the replaced node before that node is removed, so the
 * store does not drop them with the node.
 */
export function applyEngineChangePreview(
  preview: EngineChangePreview,
  jobId: string,
  ops: EngineCanvasOps,
  ids?: { nodeId: string; edgeId: (index: number) => string },
): void {
  if (preview.createNode) {
    const doomed = preview.createNode.replaceNodeId
    const anchorId =
      doomed ?? preview.createNode.positionNearNodeId ?? null
    const anchor = anchorId ? ops.nodes[anchorId] : undefined
    const pos = anchor?.position ?? [0, 0, 0]
    const nodeId = ids?.nodeId ?? crypto.randomUUID()
    ops.addNode({
      id: nodeId,
      type: preview.createNode.type,
      label: labelForNewNode(preview.createNode.engine),
      position: [pos[0] + 1, pos[1], pos[2]],
      config: configForPreviewCreateNode(preview.createNode),
      status: 'idle',
    })
    if (doomed && ops.nodes[doomed]) {
      const incident = Object.values(ops.edges).filter(
        (edge) => edge.sourceId === doomed || edge.targetId === doomed,
      )
      incident.forEach((edge, index) => {
        ops.removeEdge(edge.id)
        ops.addEdge({
          ...edge,
          id: ids?.edgeId(index) ?? crypto.randomUUID(),
          sourceId: edge.sourceId === doomed ? nodeId : edge.sourceId,
          targetId: edge.targetId === doomed ? nodeId : edge.targetId,
        })
      })
    }
    ops.setJobBinding(jobId, nodeId)
  }

  if (preview.bindToNodeId) {
    const host = ops.nodes[preview.bindToNodeId]
    if (host) {
      ops.updateNodeConfig(
        preview.bindToNodeId,
        configPatchForEngine(host.type, preview.engine),
      )
      renameStockLabel(ops, host, preview.engine)
    }
    ops.setJobBinding(jobId, preview.bindToNodeId)
  }
  if (preview.patchNodeId) {
    const host = ops.nodes[preview.patchNodeId]
    if (host) {
      ops.updateNodeConfig(
        preview.patchNodeId,
        configPatchForEngine(host.type, preview.engine),
      )
      renameStockLabel(ops, host, preview.engine)
    }
    ops.setJobBinding(jobId, preview.patchNodeId)
  }
  for (const id of preview.removeNodeIds) {
    if (ops.nodes[id]) ops.removeNode(id)
  }
}
