import { useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { syncZoneForNode } from '../compose/syncZoneForNode'
import { useDragLiveEpoch } from '../hooks/useEdgeRenderModel'
import { getDragLive } from '../store/dragLiveStore'
import type { SvgNode, SvgZone } from '../store/svgTypes'
import { ZoneLayer } from './ZoneLayer'

type LiveZoneLayerProps = {
  zones: SvgZone[]
  nodes: SvgNode[]
  selectedOwnerIds: string[]
  ownerOpacityById?: Map<string, number>
  onZonePointerDown: (
    ownerNodeId: string,
    e: ReactPointerEvent<SVGElement>,
  ) => void
  onZonePointerEnter?: (ownerNodeId: string) => void
  onZonePointerLeave?: (ownerNodeId: string) => void
}

/** Zones that follow drag-live without re-rendering SvgDesignCanvas. */
export function LiveZoneLayer({
  zones,
  nodes,
  selectedOwnerIds,
  ownerOpacityById,
  onZonePointerDown,
  onZonePointerEnter,
  onZonePointerLeave,
}: LiveZoneLayerProps) {
  const epoch = useDragLiveEpoch()
  const drag = getDragLive()
  const nodeById = useMemo(() => {
    const map = new Map<string, SvgNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  const liveZones = useMemo(() => {
    if (!drag) return zones
    return zones.map((zone) => {
      if (!drag.idSet.has(zone.ownerNodeId)) return zone
      const n = nodeById.get(zone.ownerNodeId)
      const o = drag.origins[zone.ownerNodeId]
      if (!n || !o) return zone
      return (
        syncZoneForNode({
          ...n,
          x: o.x + drag.dx,
          y: o.y + drag.dy,
        }) ?? zone
      )
    })
  }, [zones, nodeById, drag, epoch])

  return (
    <ZoneLayer
      zones={liveZones}
      selectedOwnerIds={selectedOwnerIds}
      ownerOpacityById={ownerOpacityById}
      onZonePointerDown={onZonePointerDown}
      onZonePointerEnter={onZonePointerEnter}
      onZonePointerLeave={onZonePointerLeave}
    />
  )
}
