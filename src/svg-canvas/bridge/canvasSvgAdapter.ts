/**
 * Maps product `canvasStore` nodes ↔ SVG design-scene view models.
 * Lattice indices are shared: canvas `[x,y,z]` uses col=x/2, row=z/2
 * (see `canvas/utils/positionAdapter`); SVG world uses the Cloudcraft iso projector.
 */
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { isoToNode, nodeToIso } from '../../canvas/utils/positionAdapter'
import {
  isoToScreen,
  screenToIso,
  snapWorld,
  type WorldPoint,
} from '../math/iso'
import {
  defaultTopology,
  packingForEngine,
  type Archetype,
  type SvgNode,
} from '../store/svgTypes'
import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import { backendSupportsReplicas } from '../../lib/backendCapabilities'
import { clampShards } from '../compose/composeGlyph'

export type CanvasNodeType = CanvasNode['type']

const ARCHETYPE_BY_TYPE: Record<CanvasNodeType, Archetype> = {
  compute: 'app-server',
  database: 'database',
  cache: 'cache',
  load_balancer: 'load-balancer',
  message_queue: 'message-queue',
  worker: 'worker',
  client: 'client',
}

const TYPE_BY_ARCHETYPE: Record<Archetype, CanvasNodeType> = {
  'app-server': 'compute',
  database: 'database',
  cache: 'cache',
  'load-balancer': 'load_balancer',
  'message-queue': 'message_queue',
  worker: 'worker',
  client: 'client',
}

export function canvasTypeToArchetype(type: CanvasNodeType): Archetype {
  return ARCHETYPE_BY_TYPE[type]
}

export function archetypeToCanvasType(archetype: Archetype): CanvasNodeType {
  return TYPE_BY_ARCHETYPE[archetype]
}

/** Canvas store position → SVG world (user units). */
export function canvasPositionToSvgWorld(
  pos: [number, number, number],
): WorldPoint {
  const { col, row } = nodeToIso(pos)
  return isoToScreen(col, row)
}

/** SVG world → canvas store position (integer lattice via nodeToIso convention). */
export function svgWorldToCanvasPosition(
  x: number,
  y: number,
): [number, number, number] {
  const snapped = snapWorld(x, y)
  const { i, j } = screenToIso(snapped.x, snapped.y)
  return isoToNode(Math.round(i), Math.round(j))
}

export function engineFromCanvasNode(node: CanvasNode): string {
  const c = node.config
  switch (node.type) {
    case 'database':
    case 'message_queue':
      return String(c.engine ?? (node.type === 'database' ? 'postgresql' : 'rabbitmq'))
    case 'cache':
      return String(c.cacheEngine ?? c.engine ?? 'redis')
    default:
      return 'generic'
  }
}

export function replicasFromCanvasNode(node: CanvasNode): number {
  if (node.type === 'database') {
    const read = Number(node.config.readReplicas ?? 0)
    const n = 1 + (Number.isFinite(read) ? Math.max(0, read) : 0)
    return Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(n)))
  }
  if (node.type === 'load_balancer' || node.type === 'client') return 1
  const r = Number(node.config.replicas ?? 1)
  return Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(Number.isFinite(r) ? r : 1)))
}

export function shardsFromCanvasNode(node: CanvasNode): number {
  if (node.type === 'database' || node.type === 'message_queue') {
    return clampShards(Number(node.config.shards ?? 1))
  }
  return 1
}

/** Config patch when the SVG engine select changes. */
export function configPatchForEngine(
  type: CanvasNodeType,
  engine: string,
): Record<string, unknown> {
  switch (type) {
    case 'cache':
      return { cacheEngine: engine, engine }
    case 'database':
    case 'message_queue':
      return { engine }
    default:
      return {}
  }
}

/** Config patch when the SVG replicas stepper changes. */
export function configPatchForReplicas(
  type: CanvasNodeType,
  replicas: number,
): Record<string, unknown> {
  if (!backendSupportsReplicas(type)) return {}
  const next = Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas)))
  return { replicas: next }
}

export function configPatchForShards(shards: number): Record<string, unknown> {
  return { shards: clampShards(shards) }
}

export function canvasNodeToSvgNode(node: CanvasNode): SvgNode {
  const archetype = canvasTypeToArchetype(node.type)
  const engine = engineFromCanvasNode(node)
  const replicas = replicasFromCanvasNode(node)
  const shards = shardsFromCanvasNode(node)
  const world = canvasPositionToSvgWorld(node.position)
  const packing = packingForEngine(engine, replicas, archetype)
  return {
    id: node.id,
    archetype,
    engine,
    x: world.x,
    y: world.y,
    label: node.label,
    config: { ...node.config },
    topology: {
      ...defaultTopology(),
      replicas,
      shards,
      packing:
        (archetype === 'message-queue' || archetype === 'database') && shards > 1
          ? 'fan'
          : packing,
    },
  }
}
