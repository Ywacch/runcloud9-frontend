import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'
import { clampAppServerReplicas } from './replicaConfig'
import { getTopologyRulesCached } from './topologyRulesStore'

export type SingletonCollapseKind = 'app-server' | 'worker'

export interface MultiSingletonGroup {
  kind: SingletonCollapseKind
  /** Canvas node type for the group. */
  canvasType: 'compute' | 'worker'
  nodes: CanvasNode[]
  scaleWithReplicas: boolean
}

export interface SingletonCollapsePlan {
  kind: SingletonCollapseKind
  keepId: string
  removeIds: string[]
  summedReplicas: number
  cappedReplicas: number
  wasCapped: boolean
  maxAllowed: number
}

function semanticOf(node: CanvasNode): string | null {
  return canvasToBackend[node.type] ?? null
}

function nodeReplicaCount(node: CanvasNode): number {
  const raw = Number(node.config.replicas ?? 1)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.floor(raw)
}

function canvasTypeForSemantic(
  semantic: string,
): 'compute' | 'worker' | null {
  if (semantic === 'app-server') return 'compute'
  if (semantic === 'worker') return 'worker'
  return null
}

/**
 * First multi-singleton group that may be collapsed via replicas
 * (scaleWithReplicas from topology-rules). Infra singletons (cache/db/mq)
 * are honesty-only — no merge CTA.
 */
export function findMultiSingletonGroup(
  nodes: Record<string, CanvasNode>,
): MultiSingletonGroup | null {
  const byType = new Map<string, CanvasNode[]>()
  for (const node of Object.values(nodes)) {
    const semantic = semanticOf(node)
    if (!semantic) continue
    const list = byType.get(semantic) ?? []
    list.push(node)
    byType.set(semantic, list)
  }

  for (const rule of getTopologyRulesCached().singletons) {
    const group = byType.get(rule.nodeType)
    if (!group || group.length <= 1) continue
    if (!rule.scaleWithReplicas) continue
    const canvasType = canvasTypeForSemantic(rule.nodeType)
    if (!canvasType) continue
    return {
      kind: rule.nodeType as SingletonCollapseKind,
      canvasType,
      nodes: group,
      scaleWithReplicas: true,
    }
  }
  return null
}

/**
 * Prefer the node with the most incident edges; tie-break by id for stability.
 */
function pickKeepNode(
  group: CanvasNode[],
  edges: Record<string, CanvasEdge>,
): CanvasNode {
  const degree = new Map<string, number>()
  for (const n of group) degree.set(n.id, 0)
  for (const e of Object.values(edges)) {
    if (degree.has(e.sourceId)) {
      degree.set(e.sourceId, (degree.get(e.sourceId) ?? 0) + 1)
    }
    if (degree.has(e.targetId)) {
      degree.set(e.targetId, (degree.get(e.targetId) ?? 0) + 1)
    }
  }
  return [...group].sort((a, b) => {
    const d = (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)
    if (d !== 0) return d
    return a.id.localeCompare(b.id)
  })[0]!
}

/** Build a collapse plan; does not mutate the canvas. */
export function planSingletonCollapse(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  maxAllowed: number,
): SingletonCollapsePlan | null {
  const group = findMultiSingletonGroup(nodes)
  if (!group) return null

  const keep = pickKeepNode(group.nodes, edges)
  const removeIds = group.nodes.filter((n) => n.id !== keep.id).map((n) => n.id)
  const summed = group.nodes.reduce((sum, n) => sum + nodeReplicaCount(n), 0)
  const capped = clampAppServerReplicas(summed, maxAllowed)
  return {
    kind: group.kind,
    keepId: keep.id,
    removeIds,
    summedReplicas: summed,
    cappedReplicas: capped,
    wasCapped: capped < summed,
    maxAllowed,
  }
}

function remapEndpoint(id: string, keepId: string, remove: Set<string>): string {
  return remove.has(id) ? keepId : id
}

/**
 * Collapse multi app-server / worker nodes into one node with summed (capped) replicas.
 * Rewires edges onto the kept node and drops self-loops / duplicate pairs.
 */
export function applySingletonCollapse(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  plan: SingletonCollapsePlan,
): { nodes: Record<string, CanvasNode>; edges: Record<string, CanvasEdge> } {
  const remove = new Set(plan.removeIds)
  const keep = nodes[plan.keepId]
  if (!keep) {
    return { nodes, edges }
  }

  const nextNodes: Record<string, CanvasNode> = {}
  for (const [id, node] of Object.entries(nodes)) {
    if (remove.has(id)) continue
    if (id === plan.keepId) {
      nextNodes[id] = {
        ...node,
        config: { ...node.config, replicas: plan.cappedReplicas },
      }
    } else {
      nextNodes[id] = node
    }
  }

  const nextEdges: Record<string, CanvasEdge> = {}
  const seenPairs = new Set<string>()
  for (const edge of Object.values(edges)) {
    const sourceId = remapEndpoint(edge.sourceId, plan.keepId, remove)
    const targetId = remapEndpoint(edge.targetId, plan.keepId, remove)
    if (sourceId === targetId) continue
    if (!nextNodes[sourceId] || !nextNodes[targetId]) continue
    const pairKey = `${sourceId}\0${targetId}`
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)
    nextEdges[edge.id] = {
      ...edge,
      sourceId,
      targetId,
    }
  }

  return { nodes: nextNodes, edges: nextEdges }
}

export function singletonCollapseButtonLabel(plan: SingletonCollapsePlan): string {
  const role = plan.kind === 'app-server' ? 'app-server' : 'worker'
  if (plan.wasCapped) {
    return `Merge into one ${role} with ${plan.cappedReplicas} replicas (capped from ${plan.summedReplicas})`
  }
  return `Merge into one ${role} with ${plan.cappedReplicas} replicas`
}
