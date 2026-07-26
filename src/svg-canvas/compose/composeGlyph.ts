import {
  APP_SERVER_REPLICA_MAX,
  APP_SERVER_STACK_STEP,
  CACHE_SLAB_STACK_STEP,
  DATABASE_STACK_STEP,
  WORKER_STACK_STEP,
  composeAppServerUnits,
  type UnitOffset,
} from './composeAppServer'
import {
  composeHexClusterUnits,
  composeShardReplicaUnits,
  composeShelfStack,
} from './composePacking'
import { HALF_H, HALF_W } from '../math/iso'
import { resolveSkin, MQ_SHARD_MAX } from '../skins/engineSkins'
import type { SvgNode } from '../store/svgTypes'
import { packingForEngine } from '../store/svgTypes'

/** DB shard cap — diamond nest max 3 (Redis replicas also max 3). */
export const DB_SHARD_MAX = 3

export type ComposedGlyph = {
  units: UnitOffset[]
  tubeCount: number
  brandBody: 'redis' | null
  packing: 'stack' | 'fan'
}

/**
 * Redis multi-replica / legacy name — diamond nest from `shard-cluster.svg`.
 */
export function composeFanUnits(replicas: number): UnitOffset[] {
  return composeHexClusterUnits(
    Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas))),
  )
}

export function clampShards(
  shards: number,
  max: number = MQ_SHARD_MAX,
): number {
  return Math.max(1, Math.min(max, Math.floor(shards)))
}

/**
 * Parallel MQ shards — side-by-side (across the trough), not end-to-end.
 */
export function composeMqParallelUnits(shards: number): UnitOffset[] {
  const n = clampShards(shards)
  if (n === 1) return [{ dx: 0, dy: 0 }]
  const pitch = 0.65
  return Array.from({ length: n }, (_, i) => {
    const t = i - (n - 1) / 2
    return {
      dx: t * HALF_W * pitch,
      dy: t * HALF_H * pitch,
    }
  })
}

/**
 * Derive unit offsets + MQ/DB shard count from node archetype/engine/topology.
 */
export function composeGlyph(node: SvgNode): ComposedGlyph {
  const skin = resolveSkin(node.archetype, node.engine)
  const packing = packingForEngine(
    node.engine,
    node.topology.replicas,
    node.archetype,
  )
  const replicas = node.topology.replicas

  if (skin.brandBody === 'redis') {
    const n = Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas)))
    return {
      units: n > 1 ? composeHexClusterUnits(n) : [{ dx: 0, dy: 0 }],
      tubeCount: 1,
      brandBody: 'redis',
      packing: n > 1 ? 'fan' : 'stack',
    }
  }

  if (node.archetype === 'message-queue') {
    const tubeCount = clampShards(node.topology.shards)
    return {
      units: composeMqParallelUnits(tubeCount),
      tubeCount,
      brandBody: null,
      packing: tubeCount > 1 ? 'fan' : 'stack',
    }
  }

  if (node.archetype === 'database') {
    const shards = clampShards(node.topology.shards, DB_SHARD_MAX)
    return {
      units: composeShardReplicaUnits(
        shards,
        replicas,
        DATABASE_STACK_STEP,
        DB_SHARD_MAX,
        APP_SERVER_REPLICA_MAX,
      ),
      tubeCount: shards,
      brandBody: null,
      packing: shards > 1 ? 'fan' : 'stack',
    }
  }

  if (node.archetype === 'cache') {
    return {
      units: composeShelfStack(
        replicas,
        CACHE_SLAB_STACK_STEP,
        APP_SERVER_REPLICA_MAX,
      ),
      tubeCount: 1,
      brandBody: null,
      packing: 'stack',
    }
  }

  if (node.archetype === 'worker') {
    return {
      units: composeShelfStack(
        replicas,
        WORKER_STACK_STEP,
        APP_SERVER_REPLICA_MAX,
      ),
      tubeCount: 1,
      brandBody: null,
      packing: 'stack',
    }
  }

  if (node.archetype === 'app-server') {
    return {
      units: composeShelfStack(
        replicas,
        APP_SERVER_STACK_STEP,
        APP_SERVER_REPLICA_MAX,
      ),
      tubeCount: 1,
      brandBody: null,
      packing: 'stack',
    }
  }

  // Client / loadgen + LB — single procedural unit (never stacks).
  if (node.archetype === 'client' || node.archetype === 'load-balancer') {
    return {
      units: [{ dx: 0, dy: 0 }],
      tubeCount: 1,
      brandBody: null,
      packing: 'stack',
    }
  }

  // Fallback
  return {
    units: composeAppServerUnits(1),
    tubeCount: 1,
    brandBody: null,
    packing: packing === 'fan' ? 'fan' : 'stack',
  }
}
