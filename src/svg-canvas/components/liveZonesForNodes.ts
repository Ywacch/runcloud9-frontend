import {
  defaultExpanded,
  resolveDisplayUnits,
} from '../compose/resolveDisplayUnits'
import { syncZoneForNode } from '../compose/syncZoneForNode'
import type { DragLiveSnapshot } from '../store/dragLiveStore'
import { displayWorldPosition } from '../../lib/sessionLayoutStore'
import {
  motionKeyForNode,
} from '../store/unitMotionStore'
import { getExpanded } from '../store/expandStore'
import type { SvgNode, SvgZone } from '../store/svgTypes'

function motionUnitsFromKey(key: string): { dx: number; dy: number }[] | null {
  if (!key) return null
  return key.split('|').filter(Boolean).map((part) => {
    const colon = part.indexOf(':')
    const rest = part.slice(colon + 1)
    const [dx, dy] = rest.split(',').map(Number)
    return { dx, dy }
  })
}

function placedNode(
  node: SvgNode,
  drag: DragLiveSnapshot | null,
): SvgNode {
  const placed = displayWorldPosition(node, drag)
  if (placed.x === node.x && placed.y === node.y) return node
  return { ...node, x: placed.x, y: placed.y }
}

function liveZoneForNode(
  node: SvgNode,
  drag: DragLiveSnapshot | null,
): SvgZone | null {
  const displayExpanded = getExpanded(node.id) ?? defaultExpanded(node)
  if (!displayExpanded) return null

  const resolved = resolveDisplayUnits(node, displayExpanded)
  if (resolved.units.length <= 1) return null

  const placed = placedNode(node, drag)
  const motionKey = motionKeyForNode(node.id)
  const motionOffsets = motionUnitsFromKey(motionKey)
  return syncZoneForNode(placed, {
    units: motionOffsets ?? resolved.units,
    packing: resolved.packing,
    brandBody: resolved.brandBody,
    tubeCount: resolved.tubeCount,
  })
}

/** Live group zones for fanned multi-unit nodes (stored + synthesized stacks). */
export function liveZonesForNodes(
  zones: SvgZone[],
  nodes: SvgNode[],
  drag: DragLiveSnapshot | null,
): SvgZone[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outByOwner = new Map<string, SvgZone>()

  for (const node of nodes) {
    const live = liveZoneForNode(node, drag)
    if (live) {
      outByOwner.set(node.id, live)
    }
  }

  for (const zone of zones) {
    if (outByOwner.has(zone.ownerNodeId)) continue
    const node = nodeById.get(zone.ownerNodeId)
    if (!node) {
      outByOwner.set(zone.ownerNodeId, zone)
      continue
    }
    const motionKey = motionKeyForNode(node.id)
    const displayExpanded = getExpanded(node.id) ?? defaultExpanded(node)
    const resolved = resolveDisplayUnits(node, displayExpanded)
    const needsLiveZone =
      motionKey !== '' || displayExpanded !== defaultExpanded(node)
    if (!needsLiveZone && !drag?.idSet.has(zone.ownerNodeId)) {
      outByOwner.set(zone.ownerNodeId, zone)
      continue
    }
    const placed = placedNode(node, drag)
    const motionOffsets = motionUnitsFromKey(motionKey)
    const synced = syncZoneForNode(placed, {
      units: motionOffsets ?? resolved.units,
      packing: resolved.packing,
      brandBody: resolved.brandBody,
      tubeCount: resolved.tubeCount,
    })
    outByOwner.set(zone.ownerNodeId, synced ?? zone)
  }

  return [...outByOwner.values()]
}
