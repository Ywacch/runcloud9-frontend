import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { composeGlyph } from '../compose/composeGlyph'
import { useUnitOffsetsTween } from '../hooks/useUnitOffsetsTween'
import { resolveSkin } from '../skins/engineSkins'
import type { SvgNode } from '../store/svgTypes'
import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import { ClientLoadgenGlyph } from './ClientLoadgenGlyph'
import { RedisBrandGlyph } from './RedisBrandGlyph'
import { SpriteBackedGlyph } from './SpriteBackedGlyph'

type NodeGlyphProps = {
  node: SvgNode
  x: number
  y: number
  selected?: boolean
  interactive?: boolean
  /** Demo / live overlay; falls back to node.healthVisual. */
  healthVisual?: HealthVisualState
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerLeave?: (e: ReactPointerEvent<SVGGElement>) => void
}

function NodeGlyphInner({
  node,
  x,
  y,
  selected,
  interactive,
  healthVisual,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: NodeGlyphProps) {
  const skin = resolveSkin(node.archetype, node.engine)
  const composed = composeGlyph(node)
  const units = useUnitOffsetsTween(composed.units)
  const health = healthVisual ?? node.healthVisual ?? 'off'
  const common = {
    x,
    y,
    label: node.label,
    selected,
    interactive,
    healthVisual: health,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
  }

  // Redis keeps the measured brand 3-slab mark for now.
  if (composed.brandBody === 'redis') {
    return <RedisBrandGlyph {...common} units={units} />
  }

  switch (node.archetype) {
    case 'client':
      return <ClientLoadgenGlyph {...common} />
    case 'database':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="database"
          units={units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'cache':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="cache"
          units={units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'message-queue':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="message-queue"
          units={units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'load-balancer':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="load-balancer"
          units={[{ dx: 0, dy: 0 }]}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'worker':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="worker"
          units={units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'app-server':
    default:
      return (
        <SpriteBackedGlyph
          {...common}
          kind="app-server"
          units={units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
  }
}

function nodeGlyphPropsEqual(a: NodeGlyphProps, b: NodeGlyphProps): boolean {
  return (
    a.node.id === b.node.id &&
    a.x === b.x &&
    a.y === b.y &&
    a.selected === b.selected &&
    a.interactive === b.interactive &&
    a.healthVisual === b.healthVisual &&
    a.node.archetype === b.node.archetype &&
    a.node.engine === b.node.engine &&
    a.node.label === b.node.label &&
    a.node.healthVisual === b.node.healthVisual &&
    a.node.topology.replicas === b.node.topology.replicas &&
    a.node.topology.shards === b.node.topology.shards &&
    a.node.topology.packing === b.node.topology.packing &&
    a.onPointerDown === b.onPointerDown &&
    a.onPointerEnter === b.onPointerEnter &&
    a.onPointerLeave === b.onPointerLeave
  )
}

export const NodeGlyph = memo(NodeGlyphInner, nodeGlyphPropsEqual)
