import type { WorldPoint } from '../math/iso'

export type Archetype =
  | 'app-server'
  | 'database'
  | 'cache'
  | 'message-queue'
  | 'load-balancer'
  | 'worker'
  | 'client'

/** How multi-replica units are laid out. Zone boundary only for `fan`. */
export type ReplicaPacking = 'stack' | 'fan'

export type NodeTopology = {
  replicas: number
  shards: number
  /** Default `stack` = vertical shelf, no zone. `fan` = in-plane + zone. */
  packing: ReplicaPacking
}

/**
 * Design-scene node. `engine` drives skin / Redis brand-body.
 * `config` holds inspector fields when wired; copy/paste and undo deep-clone it.
 */
export type SvgNode = {
  id: string
  archetype: Archetype
  engine: string
  x: number
  y: number
  label: string
  config: Record<string, unknown>
  topology: NodeTopology
}

/** Auto composition boundary for replicas (not a user-placed Area). */
export type SvgZone = {
  id: string
  ownerNodeId: string
  kind: 'replicas'
  originI: number
  originJ: number
  /** Footprint size in half-cell lattice units (same as originI/J). */
  cols: number
  rows: number
  label: string
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

export function defaultTopology(): NodeTopology {
  return { replicas: 1, shards: 1, packing: 'stack' }
}

/** Packing for Redis multi-replica = in-plane fan + zone; else stack. */
export function packingForEngine(
  engine: string,
  replicas: number,
  _archetype?: SvgNode['archetype'],
): ReplicaPacking {
  if (engine === 'redis' && replicas > 1) return 'fan'
  return 'stack'
}

export function cloneSvgNode(node: SvgNode): SvgNode {
  return {
    ...node,
    engine: node.engine,
    config: structuredClone(node.config),
    topology: { ...node.topology },
  }
}

export function cloneSvgEdge(edge: SvgEdge): SvgEdge {
  return {
    ...edge,
    waypoints: edge.waypoints.map((p) => ({ ...p })),
    style: { ...edge.style },
  }
}

export function cloneSvgZone(zone: SvgZone): SvgZone {
  return { ...zone }
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
