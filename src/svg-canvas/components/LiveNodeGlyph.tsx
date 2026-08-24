import {
  memo,
  useEffect,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useReducedMotion } from '../fx/reducedMotion'
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
  appear?: boolean
  onPointerDown: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onUnitPointerDown?: (unitIndex: number, e: ReactPointerEvent<SVGGElement>) => void
  onUnitPointerEnter?: (unitIndex: number) => void
  onUnitPointerLeave?: (unitIndex: number) => void
}

function liveKey(nodeId: string): string {
  return dragLiveKeyForNode(nodeId)
}

function LiveNodeGlyphInner({
  node,
  selected,
  interactive,
  opacity,
  appear = false,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onUnitPointerDown,
  onUnitPointerEnter,
  onUnitPointerLeave,
}: LiveNodeGlyphProps) {
  const reducedMotion = useReducedMotion()
  const key = useSyncExternalStore(
    subscribeDragLive,
    () => liveKey(node.id),
    () => '',
  )
  const live = parseDragLiveKey(key)
  const x = live?.x ?? node.x
  const y = live?.y ?? node.y

  const shouldAnimateAppear = appear && !reducedMotion
  const [appeared, setAppeared] = useState(!shouldAnimateAppear)
  useEffect(() => {
    if (!shouldAnimateAppear) {
      setAppeared(true)
      return
    }
    setAppeared(false)
    const id = requestAnimationFrame(() => setAppeared(true))
    return () => cancelAnimationFrame(id)
  }, [shouldAnimateAppear, node.id])

  const appearOpacity = appeared ? 1 : 0
  const appearScale = appeared ? 1 : 0.9
  const transition = reducedMotion
    ? undefined
    : 'opacity 300ms ease-out, transform 300ms ease-out'

  return (
    <g
      opacity={opacity * appearOpacity}
      transform={`scale(${appearScale})`}
      style={{ transition }}
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
        onUnitPointerDown={onUnitPointerDown}
        onUnitPointerEnter={onUnitPointerEnter}
        onUnitPointerLeave={onUnitPointerLeave}
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
    a.appear === b.appear &&
    a.onPointerDown === b.onPointerDown &&
    a.onPointerEnter === b.onPointerEnter &&
    a.onPointerLeave === b.onPointerLeave &&
    a.onUnitPointerDown === b.onUnitPointerDown &&
    a.onUnitPointerEnter === b.onUnitPointerEnter &&
    a.onUnitPointerLeave === b.onUnitPointerLeave
  )
}

export const LiveNodeGlyph = memo(LiveNodeGlyphInner, propsEqual)
