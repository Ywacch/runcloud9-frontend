import type { WorldPoint } from '../math/iso'

export type Archetype = 'app-server'

/**
 * Design-scene node. `config` holds engine/inspector fields when wired;
 * copy/paste and undo deep-clone it so configs survive duplication.
 */
export type SvgNode = {
  id: string
  archetype: Archetype
  x: number
  y: number
  label: string
  config: Record<string, unknown>
}

export type SvgEdgeStyle = {
  color: string
  width: number
  dash: 'none' | '8,6'
  startStyle: 'none' | 'arrow'
  endStyle: 'none' | 'arrow'
}

export type SvgEdge = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  waypoints: WorldPoint[]
  style: SvgEdgeStyle
}

export function cloneSvgNode(node: SvgNode): SvgNode {
  return {
    ...node,
    config: structuredClone(node.config),
  }
}

export function cloneSvgEdge(edge: SvgEdge): SvgEdge {
  return {
    ...edge,
    waypoints: edge.waypoints.map((p) => ({ ...p })),
    style: { ...edge.style },
  }
}

export function emptyConfig(): Record<string, unknown> {
  return {}
}

export function defaultEdgeStyle(): SvgEdgeStyle {
  return {
    color: '#54626f',
    width: 2,
    dash: 'none',
    startStyle: 'none',
    endStyle: 'arrow',
  }
}
