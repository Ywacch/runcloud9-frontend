import { useMemo, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  getExpanded,
  getExpandEpoch,
  subscribeExpand,
} from '../store/expandStore'
import {
  defaultExpanded,
  resolveDisplayUnits,
} from '../compose/resolveDisplayUnits'
import { syncZoneForNode } from '../compose/syncZoneForNode'
import { useDragLiveEpoch } from '../hooks/useEdgeRenderModel'
import { getDragLive } from '../store/dragLiveStore'
import {
  getUnitMotionEpoch,
  motionKeyForNode,
  subscribeUnitMotion,
} from '../store/unitMotionStore'
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

function motionUnitsFromKey(key: string): { dx: number; dy: number }[] | null {
  if (!key) return null
  return key.split('|').filter(Boolean).map((part) => {
    const colon = part.indexOf(':')
    const rest = part.slice(colon + 1)
    const [dx, dy] = rest.split(',').map(Number)
    return { dx, dy }
  })
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
  useSyncExternalStore(subscribeUnitMotion, () => getUnitMotionEpoch(), () => 0)
  useSyncExternalStore(subscribeExpand, () => getExpandEpoch(), () => 0)
  const drag = getDragLive()
  const nodeById = useMemo(() => {
    const map = new Map<string, SvgNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  const liveZones = useMemo(() => {
    const out: SvgZone[] = []
    for (const zone of zones) {
      const n = nodeById.get(zone.ownerNodeId)
      if (!n) {
        out.push(zone)
        continue
      }
      let placed = n
      if (drag?.idSet.has(zone.ownerNodeId)) {
        const o = drag.origins[zone.ownerNodeId]
        if (o) placed = { ...n, x: o.x + drag.dx, y: o.y + drag.dy }
      }

      const expanded = getExpanded(n.id) ?? defaultExpanded(n)
      const needsLiveZone =
        motionKeyForNode(n.id) !== '' || expanded !== defaultExpanded(n)

      if (!needsLiveZone && !drag?.idSet.has(zone.ownerNodeId)) {
        out.push(zone)
        continue
      }

      const resolved = resolveDisplayUnits(n, expanded)
      const motionKey = motionKeyForNode(n.id)
      const motionOffsets = motionUnitsFromKey(motionKey)
      const override = {
        units: motionOffsets ?? resolved.units,
        packing: resolved.packing,
        brandBody: resolved.brandBody,
        tubeCount: resolved.tubeCount,
      }
      const z = syncZoneForNode(placed, override)
      if (z) out.push(z)
    }
    return out
  }, [zones, nodeById, drag, getUnitMotionEpoch(), getExpandEpoch()])

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