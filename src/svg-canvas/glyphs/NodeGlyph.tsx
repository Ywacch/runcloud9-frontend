import { composeGlyph } from '../compose/composeGlyph'
import { resolveSkin } from '../skins/engineSkins'
import type { SvgNode } from '../store/svgTypes'
import { RedisBrandGlyph } from './RedisBrandGlyph'
import { SpriteBackedGlyph } from './SpriteBackedGlyph'
import type { PointerEvent as ReactPointerEvent } from 'react'

type NodeGlyphProps = {
  node: SvgNode
  x: number
  y: number
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

export function NodeGlyph({
  node,
  x,
  y,
  selected,
  interactive,
  onPointerDown,
}: NodeGlyphProps) {
  const skin = resolveSkin(node.archetype, node.engine)
  const composed = composeGlyph(node)
  const common = {
    x,
    y,
    label: node.label,
    selected,
    interactive,
    onPointerDown,
  }

  // Redis keeps the measured brand 3-slab mark for now.
  if (composed.brandBody === 'redis') {
    return <RedisBrandGlyph {...common} units={composed.units} />
  }

  switch (node.archetype) {
    case 'database':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="database"
          units={composed.units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'cache':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="cache"
          units={composed.units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
    case 'message-queue':
      return (
        <SpriteBackedGlyph
          {...common}
          kind="message-queue"
          units={composed.units}
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
          units={composed.units}
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
          units={composed.units}
          logoId={skin.logoId}
          tint={skin.brandTint}
        />
      )
  }
}
