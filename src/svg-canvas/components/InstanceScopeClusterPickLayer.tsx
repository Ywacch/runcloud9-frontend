import { useMemo, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasMode, CanvasNode } from '../../editor-core/stores/canvasStore'
import { useMetricsStore } from '../../editor-core/stores/metricsStore'
import { isInstanceScopeViewportMode } from '../../lib/devInstanceScopePreview'
import {
  metricsInstancePickKey,
  unitPickEnabledForDisplay,
} from '../../lib/canvasInstanceScope'
import { defaultExpanded, resolveDisplayUnits } from '../compose/resolveDisplayUnits'
import { getExpandEpoch, subscribeExpand, getExpanded } from '../store/expandStore'
import { getDragLive } from '../store/dragLiveStore'
import { useDragLiveEpoch } from '../hooks/useEdgeRenderModel'
import { isoFootprintDiamond } from '../math/iso'
import type { SvgNode } from '../store/svgTypes'
import { liveZonesForNodes } from './liveZonesForNodes'

type InstanceScopeClusterPickLayerProps = {
  canvasMode: CanvasMode
  canvasNodes: Record<string, CanvasNode>
  nodes: SvgNode[]
  selectedIds: string[]
  ownerOpacityById?: Map<string, number>
  onClusterPointerDown: (
    ownerNodeId: string,
    e: ReactPointerEvent<SVGElement>,
  ) => void
  onClusterPointerEnter?: (ownerNodeId: string) => void
  onClusterPointerLeave?: (ownerNodeId: string) => void
}

export function InstanceScopeClusterPickLayer({
  canvasMode,
  canvasNodes,
  nodes,
  selectedIds,
  ownerOpacityById,
  onClusterPointerDown,
  onClusterPointerEnter,
  onClusterPointerLeave,
}: InstanceScopeClusterPickLayerProps) {
  useDragLiveEpoch()
  const expandEpoch = useSyncExternalStore(subscribeExpand, getExpandEpoch, () => 0)
  const metricsPickKey = useMetricsStore((s) =>
    isInstanceScopeViewportMode(canvasMode)
      ? metricsInstancePickKey(s.metrics, canvasNodes)
      : '',
  )

  const clusterPickZones = useMemo(() => {
    if (!isInstanceScopeViewportMode(canvasMode) || selectedIds.length === 0) {
      return []
    }
    const metrics = useMetricsStore.getState().metrics
    const drag = getDragLive()
    const liveZones = liveZonesForNodes([], nodes, drag)
    const selected = new Set(selectedIds)

    return liveZones.filter((zone) => {
      if (!selected.has(zone.ownerNodeId)) return false
      const canvasNode = canvasNodes[zone.ownerNodeId]
      const svgNode = nodes.find((n) => n.id === zone.ownerNodeId)
      if (!canvasNode || !svgNode) return false
      const displayExpanded = getExpanded(svgNode.id) ?? defaultExpanded(svgNode)
      const unitCount = resolveDisplayUnits(svgNode, displayExpanded).units.length
      return unitPickEnabledForDisplay(
        displayExpanded,
        canvasNode,
        metrics[zone.ownerNodeId],
        unitCount,
      )
    })
  }, [canvasMode, canvasNodes, nodes, selectedIds, metricsPickKey, expandEpoch])

  if (clusterPickZones.length === 0) return null

  return (
    <g data-cluster-pick-layer="">
      {clusterPickZones.map((zone) => {
        const pts = isoFootprintDiamond(
          zone.originI,
          zone.originJ,
          zone.cols,
          zone.rows,
        )
        const top = pts[0]
        const opacity = ownerOpacityById?.get(zone.ownerNodeId) ?? 1
        return (
          <g key={zone.id} opacity={opacity}>
            <rect
              x={top.x - 28}
              y={top.y - 28}
              width={56}
              height={24}
              fill="transparent"
              style={{ pointerEvents: 'fill', cursor: 'pointer' }}
              onPointerDown={(e) => onClusterPointerDown(zone.ownerNodeId, e)}
              onPointerEnter={() => onClusterPointerEnter?.(zone.ownerNodeId)}
              onPointerLeave={() => onClusterPointerLeave?.(zone.ownerNodeId)}
            />
          </g>
        )
      })}
    </g>
  )
}
