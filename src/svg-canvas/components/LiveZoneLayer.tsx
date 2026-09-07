import { useMemo, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  getExpandEpoch,
  subscribeExpand,
} from '../store/expandStore'
import { useDragLiveEpoch, useSessionLayoutEpoch } from '../hooks/useEdgeRenderModel'
import { getDragLive } from '../store/dragLiveStore'
import {
  getUnitMotionEpoch,
  subscribeUnitMotion,
} from '../store/unitMotionStore'
import type { SvgNode, SvgZone } from '../store/svgTypes'
import { liveZonesForNodes } from './liveZonesForNodes'
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

export function LiveZoneLayer({
  zones,
  nodes,
  selectedOwnerIds,
  ownerOpacityById,
  onZonePointerDown,
  onZonePointerEnter,
  onZonePointerLeave,
}: LiveZoneLayerProps) {
  useDragLiveEpoch()
  useSessionLayoutEpoch()
  useSyncExternalStore(subscribeUnitMotion, () => getUnitMotionEpoch(), () => 0)
  useSyncExternalStore(subscribeExpand, () => getExpandEpoch(), () => 0)
  const drag = getDragLive()

  const liveZones = useMemo(
    () => liveZonesForNodes(zones, nodes, drag),
    [zones, nodes, drag, getUnitMotionEpoch(), getExpandEpoch()],
  )

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