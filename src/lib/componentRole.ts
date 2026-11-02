import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { readConsistencyFromConfig } from './readConsistency'
import { clampReadReplicas } from './replicaConfig'
import { matchesWhen } from './storytellingEngine'
import type { StorytellingSpec } from './storytellingTypes'
import { canvasToBackend } from './typeMapping'

export interface TopologyFlags {
  hasMQ: boolean
  hasWorker: boolean
  hasCache: boolean
  hasLB: boolean
  hasDB: boolean
  /** Max readReplicas across database nodes (0 when none). */
  dbReadReplicas: number
  /** Read consistency policy on the first database node (leader-only when none). */
  readConsistency: string
  cacheStrategy: string
}

type RoleKey =
  | 'cache'
  | 'db'
  | 'mq'
  | 'worker'
  | 'app-server'
  | 'lb'

const roleKeyLabels: Record<RoleKey | 'client', string> = {
  cache: 'Redis',
  db: 'PostgreSQL',
  mq: 'Message Queue',
  worker: 'Worker',
  'app-server': 'App Server',
  lb: 'Load Balancer',
  client: 'Client',
}

export function getTopologyFlags(nodes: Record<string, CanvasNode>): TopologyFlags {
  const vals = Object.values(nodes)
  const types = new Set(vals.map((n) => n.type))
  const cacheNode = vals.find((n) => n.type === 'cache')
  const dbNodes = vals.filter((n) => n.type === 'database')
  const dbReadReplicas = dbNodes.reduce(
    (max, node) => Math.max(max, clampReadReplicas(node.config.readReplicas)),
    0,
  )
  const readConsistency = readConsistencyFromConfig(
    dbNodes[0]?.config?.readConsistency,
  )
  return {
    hasMQ: types.has('message_queue'),
    hasWorker: types.has('worker'),
    hasCache: types.has('cache'),
    hasLB: types.has('load_balancer'),
    hasDB: types.has('database'),
    dbReadReplicas,
    readConsistency,
    cacheStrategy: String(
      cacheNode?.config?.cacheStrategy ?? cacheNode?.config?.strategy ?? 'cache-aside',
    ),
  }
}

function canvasTypeToRoleKey(type: CanvasNode['type']): RoleKey | 'client' | null {
  const k = canvasToBackend[type]
  if (k === 'client') return 'client'
  if (
    k === 'cache' ||
    k === 'db' ||
    k === 'mq' ||
    k === 'worker' ||
    k === 'app-server' ||
    k === 'lb'
  ) {
    return k
  }
  return null
}

/**
 * Topology-aware role description for a node from template `storytelling.roles`,
 * with fallbacks to generic component labels.
 */
export function resolveRole(
  canvasNodeType: CanvasNode['type'],
  _templateId: string | null,
  topology: TopologyFlags,
  storytelling: StorytellingSpec | null | undefined,
): string {
  const rk = canvasTypeToRoleKey(canvasNodeType)
  if (!rk || rk === 'client') {
    return roleKeyLabels.client
  }

  const roleSpec = storytelling?.roles?.[rk]
  if (!roleSpec) {
    return roleKeyLabels[rk] ?? canvasNodeType
  }
  if (roleSpec.variants) {
    for (const v of roleSpec.variants) {
      if (matchesWhen(v.when, topology)) return v.label ?? roleKeyLabels[rk]
    }
  }
  return roleSpec.base ?? roleKeyLabels[rk] ?? canvasNodeType
}

const CACHE_ENGINE_NAMES: Record<string, string> = {
  redis: 'Redis',
  memcached: 'Memcached',
  valkey: 'Valkey',
}

/** Storytelling copy names Redis. Swap that word when the cache engine differs. */
export function withCacheEngineName(
  text: string,
  engine: string | null | undefined,
): string {
  const name = CACHE_ENGINE_NAMES[String(engine ?? 'redis').trim().toLowerCase()]
  if (!name || name === 'Redis') return text
  return text.replaceAll('Redis', name)
}
