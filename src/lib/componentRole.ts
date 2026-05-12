import type { CanvasNode } from '../store/canvasStore'
import { canvasToBackend } from './typeMapping'

export interface TopologyFlags {
  hasMQ: boolean
  hasWorker: boolean
  hasCache: boolean
  hasLB: boolean
}

interface RoleSpec {
  base: string
  variants?: {
    condition: (t: TopologyFlags) => boolean
    modifier: string
  }[]
}

/** Backend component keys used in role registry (matches deploy / WS). */
type RoleKey =
  | 'cache'
  | 'db'
  | 'mq'
  | 'worker'
  | 'app-server'
  | 'lb'

const roleRegistry: Record<string, Partial<Record<RoleKey, RoleSpec>>> = {
  'social-feed': {
    cache: {
      base: 'Timeline store for follower feeds',
      variants: [
        {
          condition: (t) => t.hasMQ && t.hasWorker,
          modifier: 'Receives async fan-out writes from worker',
        },
        {
          condition: (t) => !t.hasMQ,
          modifier: 'Receives sync fan-out writes from app-server',
        },
      ],
    },
    mq: { base: 'Post queue — buffers new posts for async fan-out' },
    worker: {
      base: 'Fan-out worker — writes to follower timelines',
      variants: [
        {
          condition: (t) => !t.hasCache,
          modifier: 'No cache target — fan-out writes have nowhere to go',
        },
      ],
    },
    db: { base: 'Source of truth — users, posts, follows graph' },
    'app-server': {
      base: 'Handles post creation and feed reads',
      variants: [
        {
          condition: (t) => !t.hasCache && !t.hasMQ,
          modifier: 'Pull mode — every feed read is a DB JOIN',
        },
        {
          condition: (t) => t.hasCache && !t.hasMQ,
          modifier: 'Sync fan-out on write, Redis reads on read',
        },
        {
          condition: (t) => t.hasMQ,
          modifier: 'Posts go to MQ, feed reads from Redis',
        },
      ],
    },
    lb: { base: 'Distributes requests across app-server instances' },
  },
  'url-shortener': {
    cache: { base: 'Lookup cache for shortened URLs' },
    db: { base: 'URL storage — code-to-original mapping' },
    'app-server': { base: 'Handles shorten and resolve requests' },
    lb: { base: 'Distributes requests across app-server instances' },
  },
  ecommerce: {
    cache: { base: 'Product catalog cache' },
    db: { base: 'Inventory and order storage' },
    mq: { base: 'Order queue for async fulfillment' },
    worker: { base: 'Order fulfillment processor' },
    'app-server': { base: 'Handles catalog browsing and checkout' },
    lb: { base: 'Distributes requests across app-server instances' },
  },
}

roleRegistry['social-feed-pull'] = roleRegistry['social-feed']

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
  const types = new Set(Object.values(nodes).map((n) => n.type))
  return {
    hasMQ: types.has('message_queue'),
    hasWorker: types.has('worker'),
    hasCache: types.has('cache'),
    hasLB: types.has('load_balancer'),
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
 * Topology-aware role description for a node.
 * Falls back to a readable label when the template has no registry entry.
 */
export function resolveRole(
  canvasNodeType: CanvasNode['type'],
  templateId: string | null,
  topology: TopologyFlags
): string {
  const rk = canvasTypeToRoleKey(canvasNodeType)
  if (!rk || rk === 'client') {
    return roleKeyLabels.client
  }

  const templateRoles = roleRegistry[templateId ?? '']
  if (!templateRoles) {
    return roleKeyLabels[rk] ?? canvasNodeType
  }

  const spec = templateRoles[rk]
  if (!spec) {
    return roleKeyLabels[rk] ?? canvasNodeType
  }

  if (spec.variants) {
    for (const v of spec.variants) {
      if (v.condition(topology)) return `${spec.base} · ${v.modifier}`
    }
  }
  return spec.base
}
