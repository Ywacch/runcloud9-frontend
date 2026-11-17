import {
  isoFootprintDiamond,
  pointsAttr,
} from '../math/iso'
import { presentWorld } from '../math/projection'
import { useProjectionT } from '../store/projectionStore'
import type { SvgZone } from '../store/svgTypes'
import type { PointerEvent as ReactPointerEvent } from 'react'

type ZoneLayerProps = {
  zones: SvgZone[]
  selectedOwnerIds: string[]
  /** Walkthrough dimming keyed by owner node id (1 = full). */
  ownerOpacityById?: Map<string, number>
  onZonePointerDown: (ownerNodeId: string, e: ReactPointerEvent<SVGElement>) => void
  onZonePointerEnter?: (ownerNodeId: string) => void
  onZonePointerLeave?: (ownerNodeId: string) => void
}

export function ZoneLayer({
  zones,
  selectedOwnerIds,
  ownerOpacityById,
  onZonePointerDown,
  onZonePointerEnter,
  onZonePointerLeave,
}: ZoneLayerProps) {
  const selected = new Set(selectedOwnerIds)
  const projectionT = useProjectionT()

  return (
    <g data-zone-layer>
      {zones.map((zone) => {
        const pts = isoFootprintDiamond(
          zone.originI,
          zone.originJ,
          zone.cols,
          zone.rows,
        ).map((p) => presentWorld(p, projectionT))
        const isSel = selected.has(zone.ownerNodeId)
        const top = pts[0]
        const opacity = ownerOpacityById?.get(zone.ownerNodeId) ?? 1
        return (
          <g
            key={zone.id}
            data-zone-owner={zone.ownerNodeId}
            opacity={opacity}
          >
            <polygon
              points={pointsAttr(pts)}
              fill="rgba(84, 98, 111, 0.14)"
              stroke={isSel ? '#3b82f6' : '#54626f'}
              strokeWidth={isSel ? 2.5 : 1.5}
              style={{ pointerEvents: 'fill', cursor: 'pointer' }}
              onPointerDown={(e) => onZonePointerDown(zone.ownerNodeId, e)}
              onPointerEnter={() => onZonePointerEnter?.(zone.ownerNodeId)}
              onPointerLeave={() => onZonePointerLeave?.(zone.ownerNodeId)}
            />
            <text
              x={top.x}
              y={top.y - 8}
              textAnchor="middle"
              fontSize={12}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fill={isSel ? '#2563eb' : '#54626f'}
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {zone.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
