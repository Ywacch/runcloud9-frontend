import { memo, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import {
  dragLiveKeyForNode,
  parseDragLiveKey,
  subscribeDragLive,
} from '../store/dragLiveStore'
import type { SvgNode } from '../store/svgTypes'
import { NodeGlyph } from '../glyphs/NodeGlyph'

type LiveNodeGlyphProps = {
  node: SvgNode
  selected: boolean
  interactive: boolean
  opacity: number
  onPointerDown: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

function liveKey(nodeId: string): string {
  return dragLiveKeyForNode(nodeId)
}

function LiveNodeGlyphInner({
  node,
  selected,
  interactive,
  opacity,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: LiveNodeGlyphProps) {
  const key = useSyncExternalStore(
    subscribeDragLive,
    () => liveKey(node.id),
    () => '',
  )
  const live = parseDragLiveKey(key)
  const x = live?.x ?? node.x
  const y = live?.y ?? node.y

  return (
    <g
      opacity={opacity}
      data-export-node=""
      data-node-id={node.id}
      data-node-label={node.label}
      data-node-archetype={node.archetype}
      data-node-engine={node.engine}
    >
      <NodeGlyph
        node={node}
        x={x}
        y={y}
        selected={selected}
        interactive={interactive}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      />
    </g>
  )
}

function propsEqual(a: LiveNodeGlyphProps, b: LiveNodeGlyphProps): boolean {
  return (
    a.node.id === b.node.id &&
    a.node.x === b.node.x &&
    a.node.y === b.node.y &&
    a.node.archetype === b.node.archetype &&
    a.node.engine === b.node.engine &&
    a.node.label === b.node.label &&
    a.node.healthVisual === b.node.healthVisual &&
    a.node.topology.replicas === b.node.topology.replicas &&
    a.node.topology.shards === b.node.topology.shards &&
    a.node.topology.packing === b.node.topology.packing &&
    a.selected === b.selected &&
    a.interactive === b.interactive &&
    a.opacity === b.opacity &&
    a.onPointerDown === b.onPointerDown &&
    a.onPointerEnter === b.onPointerEnter &&
    a.onPointerLeave === b.onPointerLeave
  )
}

export const LiveNodeGlyph = memo(LiveNodeGlyphInner, propsEqual)
