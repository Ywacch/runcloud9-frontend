import type { JourneyBackendComponent, JourneyStep } from './requestJourney'
import { backendComponentToCanvasType } from './typeMapping'
import type { CanvasEdge, CanvasNode } from '../store/canvasStore'

export function nodeIdForBackendComponent(
  component: JourneyBackendComponent,
  nodes: Record<string, CanvasNode>,
): string | null {
  const canvasType = backendComponentToCanvasType[component]
  if (!canvasType) return null
  const match = Object.values(nodes)
    .filter((n) => n.type === canvasType)
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  return match?.id ?? null
}

function buildAdjacency(edges: Record<string, CanvasEdge>): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const e of Object.values(edges)) {
    const list = adj.get(e.sourceId) ?? []
    list.push(e.targetId)
    adj.set(e.sourceId, list)
  }
  return adj
}

/** Directed edge id from source → target (BFS), or null if unreachable. */
export function findEdgeOnPath(
  sourceId: string,
  targetId: string,
  edges: Record<string, CanvasEdge>,
): string | null {
  if (sourceId === targetId) return null
  const direct = Object.values(edges).find(
    (e) => e.sourceId === sourceId && e.targetId === targetId,
  )
  if (direct) return direct.id

  const adj = buildAdjacency(edges)
  const prev = new Map<string, { nodeId: string; edgeId: string }>()
  const q: string[] = [sourceId]
  prev.set(sourceId, { nodeId: sourceId, edgeId: '' })

  while (q.length) {
    const cur = q.shift()!
    if (cur === targetId) break
    for (const next of adj.get(cur) ?? []) {
      if (prev.has(next)) continue
      const edge = Object.values(edges).find(
        (e) => e.sourceId === cur && e.targetId === next,
      )
      if (!edge) continue
      prev.set(next, { nodeId: cur, edgeId: edge.id })
      q.push(next)
    }
  }

  if (!prev.has(targetId)) return null

  let walk = targetId
  let lastEdge: string | null = null
  while (walk !== sourceId) {
    const p = prev.get(walk)
    if (!p || !p.edgeId) break
    lastEdge = p.edgeId
    walk = p.nodeId
  }
  return lastEdge
}

export interface JourneyWalkthroughPath {
  /** Node id per journey step (same order as steps). */
  stepNodeIds: (string | null)[]
  /** Edge highlighted when entering step i (edge into stepNodeIds[i]). */
  edgeIntoStep: (string | null)[]
  /** All node ids on the path (for dimming non-participants). */
  participatingNodeIds: string[]
  /** Optional client node when present on canvas. */
  clientNodeId: string | null
}

export function buildJourneyWalkthroughPath(
  steps: JourneyStep[],
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): JourneyWalkthroughPath {
  const clientNode = Object.values(nodes).find((n) => n.type === 'client')
  const clientNodeId = clientNode?.id ?? null

  const stepNodeIds = steps.map((s) =>
    nodeIdForBackendComponent(s.component, nodes),
  )

  const edgeIntoStep: (string | null)[] = []
  let prevId: string | null = clientNodeId

  for (let i = 0; i < stepNodeIds.length; i++) {
    const curId = stepNodeIds[i]
    if (prevId && curId) {
      edgeIntoStep.push(findEdgeOnPath(prevId, curId, edges))
    } else {
      edgeIntoStep.push(null)
    }
    if (curId) prevId = curId
  }

  const participating = new Set<string>()
  if (clientNodeId) participating.add(clientNodeId)
  for (const id of stepNodeIds) {
    if (id) participating.add(id)
  }

  return {
    stepNodeIds,
    edgeIntoStep,
    participatingNodeIds: [...participating],
    clientNodeId,
  }
}
