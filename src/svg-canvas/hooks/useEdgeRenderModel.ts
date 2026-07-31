import { useMemo, useSyncExternalStore } from 'react'
import { isWalkthroughRunning } from '../../canvas/utils/walkthroughVisual'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../../editor-core/stores/templateRegistryStore'
import { getCacheTopologyEdgeIssues } from '../../lib/cacheTopologyStrategy'
import {
  classifyAllCanvasEdges,
  type EdgeSemanticResult,
} from '../../lib/connectionSemantics'
import {
  getDragLiveEpoch,
  subscribeDragLive,
} from '../store/dragLiveStore'
import { useSvgCanvasStore } from '../store/svgCanvasStore'
import type { SvgEdge, SvgNode } from '../store/svgTypes'

export type EdgeRenderModel = {
  edgeSemantics: Record<string, EdgeSemanticResult>
  topologyIssues: Record<string, string>
  archetypeById: Map<string, string>
  nodeById: Map<string, SvgNode>
  walkthrough: boolean
}

/**
 * Shared edge classification + node lookup for both EdgeSegments and EdgeTerminals.
 * Call once in SvgDesignCanvas — not once per EdgeLayer mount.
 */
export function useEdgeRenderModel(_svgEdges: SvgEdge[]): EdgeRenderModel {
  const canvasMode = useCanvasStore((s) => s.mode)
  useCanvasStore((s) => s.walkthroughActiveNodeId)
  useCanvasStore((s) => s.walkthroughVisitedNodeIds)
  useCanvasStore((s) => s.walkthroughHighlightedEdgeIds)
  useCanvasStore((s) => s.walkthroughParticipatingNodeIds)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const supportsWorker = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.supportsWorker !== false : true,
  )
  const svgNodes = useSvgCanvasStore((s) => s.nodes)

  const walkthrough = isWalkthroughRunning(useCanvasStore.getState())
  const showSemanticPaint =
    (canvasMode === 'design' || canvasMode === 'simulate') && !walkthrough

  const edgeSemantics = useMemo(
    () =>
      showSemanticPaint
        ? classifyAllCanvasEdges(canvasNodes, canvasEdges, supportsWorker)
        : {},
    [showSemanticPaint, canvasNodes, canvasEdges, supportsWorker],
  )
  const topologyIssues = useMemo(
    () => getCacheTopologyEdgeIssues(canvasNodes, canvasEdges),
    [canvasNodes, canvasEdges],
  )
  const archetypeById = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of svgNodes) map.set(n.id, n.archetype)
    return map
  }, [svgNodes])
  const nodeById = useMemo(() => {
    const map = new Map<string, SvgNode>()
    for (const n of svgNodes) map.set(n.id, n)
    return map
  }, [svgNodes])

  return {
    edgeSemantics,
    topologyIssues,
    archetypeById,
    nodeById,
    walkthrough,
  }
}

export function useDragLiveEpoch(): number {
  return useSyncExternalStore(subscribeDragLive, getDragLiveEpoch, () => 0)
}
