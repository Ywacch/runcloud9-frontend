import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { WsEvent } from '../editor-core/stores/metricsStore'
import {
  clampReadReplicas,
  type ReplicationMode,
  type SyncCommitLevel,
} from './replicaConfig'
import { canvasToBackend } from './typeMapping'

export type ChaosScenario =
  | 'pod_kill'
  | 'cache_flush'
  | 'stall_replica'
  | 'split_primary_replica'
  | 'split_app_store'

export type ChaosTargetComponent =
  | 'app-server'
  | 'cache'
  | 'db'
  | 'mq'
  | 'worker'
  | 'lb'

export const PARTITION_CHAOS_SCENARIOS: ChaosScenario[] = [
  'stall_replica',
  'split_primary_replica',
  'split_app_store',
]

export const PARTITION_CAP_RULES = [
  'partition_stale_reads',
  'partition_write_stall',
] as const

export type PartitionCapRule = (typeof PARTITION_CAP_RULES)[number]

export interface ChaosRequest {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
}

export interface ChaosAppliedResponse {
  status: 'applied'
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
}

export interface ActiveChaosPartition {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
  expiresAt?: string
}

export interface ChaosScenarioContext {
  readReplicas?: number
}

const POD_KILL_TARGETS: ChaosTargetComponent[] = [
  'app-server',
  'cache',
  'db',
  'mq',
  'worker',
  'lb',
]

const ALL_SCENARIOS: ChaosScenario[] = [
  'pod_kill',
  'cache_flush',
  'stall_replica',
  'split_primary_replica',
  'split_app_store',
]

export function isPartitionChaosScenario(
  scenario: ChaosScenario,
): boolean {
  return PARTITION_CHAOS_SCENARIOS.includes(scenario)
}

export function chaosContextForNode(node: CanvasNode): ChaosScenarioContext {
  if (node.type !== 'database') return {}
  return { readReplicas: clampReadReplicas(node.config.readReplicas) }
}

export function chaosTargetForNode(
  nodeType: CanvasNode['type'],
): ChaosTargetComponent | null {
  if (nodeType === 'client') return null
  const key = canvasToBackend[nodeType]
  if (POD_KILL_TARGETS.includes(key as ChaosTargetComponent)) {
    return key as ChaosTargetComponent
  }
  return null
}

export function chaosScenariosForTarget(
  target: ChaosTargetComponent,
  ctx: ChaosScenarioContext = {},
): ChaosScenario[] {
  switch (target) {
    case 'cache':
      return ['pod_kill', 'cache_flush', 'split_app_store']
    case 'db': {
      const scenarios: ChaosScenario[] = ['pod_kill']
      if (clampReadReplicas(ctx.readReplicas) >= 1) {
        scenarios.push('stall_replica', 'split_primary_replica', 'split_app_store')
      }
      return scenarios
    }
    default:
      return ['pod_kill']
  }
}

export function chaosScenarioLabel(scenario: ChaosScenario): string {
  switch (scenario) {
    case 'pod_kill':
      return 'Kill pod'
    case 'cache_flush':
      return 'Flush cache'
    case 'stall_replica':
      return 'Stall one replica'
    case 'split_primary_replica':
      return 'Split primary from replicas'
    case 'split_app_store':
      return 'Split app from store'
  }
}

export function chaosScenarioSubtitle(
  scenario: ChaosScenario,
  target: ChaosTargetComponent,
): string {
  switch (scenario) {
    case 'cache_flush':
      return 'Wipes Redis data (cache miss spike)'
    case 'stall_replica':
      return 'Blocks replication to one standby — lag climbs on that replica'
    case 'split_primary_replica':
      return 'Cuts all replica traffic to the primary'
    case 'split_app_store':
      return target === 'cache'
        ? 'Blocks app-server from reaching Redis'
        : 'Blocks app-server from reaching the database'
    default:
      return 'Restarts one pod for this component'
  }
}

export function chaosScenarioConfirm(
  scenario: ChaosScenario,
  target: ChaosTargetComponent,
): string {
  if (scenario === 'cache_flush') {
    return 'Runs FLUSHALL on the Redis pod for this cache. Expect a miss spike on the database.'
  }
  if (scenario === 'stall_replica') {
    return 'Adds a network partition to one read replica. With two replicas and semi-sync, writes can continue while the cut replica goes stale. Heal removes the policy.'
  }
  if (scenario === 'split_primary_replica') {
    return 'Adds a network partition between the primary and every replica. Writes may stall when replication must wait on standbys. Heal removes the policy.'
  }
  if (scenario === 'split_app_store') {
    return `Adds a network partition between app-server pods and ${target}. Traffic recovers after Heal.`
  }
  if (target === 'app-server') {
    return 'Deletes one running app-server pod. Kubernetes replaces it. With multiple replicas, only one pod is removed.'
  }
  return `Deletes one running ${target} pod. Kubernetes replaces it.`
}

/** Overlay timing defaults from chaos API contract (client-owned). */
export function chaosOverlayTiming(
  scenario: ChaosScenario,
  target: ChaosTargetComponent,
): { clearAfterMs: number; minDisplayMs: number } {
  if (isPartitionChaosScenario(scenario)) {
    return { clearAfterMs: Number.POSITIVE_INFINITY, minDisplayMs: 5_000 }
  }
  if (scenario === 'cache_flush') {
    return { clearAfterMs: 25_000, minDisplayMs: 5_000 }
  }
  const byTarget: Record<ChaosTargetComponent, { clearAfterMs: number; minDisplayMs: number }> =
    {
      lb: { clearAfterMs: 20_000, minDisplayMs: 5_000 },
      cache: { clearAfterMs: 25_000, minDisplayMs: 5_000 },
      'app-server': { clearAfterMs: 60_000, minDisplayMs: 10_000 },
      worker: { clearAfterMs: 75_000, minDisplayMs: 15_000 },
      db: { clearAfterMs: 90_000, minDisplayMs: 20_000 },
      mq: { clearAfterMs: 120_000, minDisplayMs: 20_000 },
    }
  return byTarget[target] ?? { clearAfterMs: 60_000, minDisplayMs: 10_000 }
}

function parseChaosScenario(raw: string | undefined): ChaosScenario | null {
  if (!raw) return null
  return ALL_SCENARIOS.includes(raw as ChaosScenario)
    ? (raw as ChaosScenario)
    : null
}

/** Map a metrics WS chaos inject event to overlay state (description holds scenario id). */
export function chaosOverlayFromWsEvent(e: {
  source?: string
  kind?: string
  component?: string
  description?: string
  detail?: Record<string, string>
  timestamp?: string
}): {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
  startedAt: number
} | null {
  if (e.source !== 'chaos' || e.kind === 'chaos_heal') return null
  const scenario =
    parseChaosScenario(e.description) ??
    parseChaosScenario(e.detail?.scenario)
  if (!scenario) return null
  const target = (e.detail?.targetComponent ?? e.component) as ChaosTargetComponent
  if (!target) return null
  if (scenario === 'cache_flush' && target !== 'cache') return null
  if (scenario === 'pod_kill' && !POD_KILL_TARGETS.includes(target)) return null
  const t = e.timestamp ? Date.parse(e.timestamp) : NaN
  return {
    scenario,
    targetComponent: target,
    startedAt: Number.isFinite(t) ? t : Date.now(),
  }
}

export function chaosHealFromWsEvent(e: {
  source?: string
  kind?: string
}): boolean {
  return e.source === 'chaos' && e.kind === 'chaos_heal'
}

export function latestPartitionCapEvent(
  events: WsEvent[],
): WsEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const rule = events[i].rule
    if (rule === 'partition_stale_reads' || rule === 'partition_write_stall') {
      return events[i]
    }
  }
  return null
}

export function partitionCapSummary(
  capEvent: WsEvent | null,
  replicationMode: ReplicationMode,
  readReplicas: number,
  syncCommitLevel: SyncCommitLevel,
  guaranteeHeldBy?: string,
): string | null {
  if (!capEvent) return null
  const tradeoff = capEvent.detail?.capTradeoff
  if (capEvent.rule === 'partition_stale_reads') {
    let line =
      'Writes kept going; replica reads went stale while replication lagged or read-your-writes broke.'
    if (replicationMode === 'semi-sync' && readReplicas >= 2) {
      line =
        'Semi-sync with two replicas: the primary still had another standby to confirm commits, but reads on the cut replica went stale.'
    }
    if (syncCommitLevel === 'remote_apply' && guaranteeHeldBy === 'db') {
      line +=
        ' Database-layer read-your-writes can still show on the acked standby — durability quorum is not the replica you read.'
    }
    return line
  }
  if (capEvent.rule === 'partition_write_stall') {
    if (replicationMode === 'semi-sync') {
      return 'No standby could confirm the commit, so writes stalled the same way they would under full sync.'
    }
    if (tradeoff === 'consistency_over_availability') {
      return 'Replication waited on standbys, so writes stalled or timed out to keep commits consistent.'
    }
    return 'Writes stalled while the database waited on replication.'
  }
  return capEvent.description || capEvent.title
}

export function partitionActiveHint(
  scenario: ChaosScenario,
  replicationMode: ReplicationMode,
  readReplicas: number,
): string {
  if (scenario === 'stall_replica' && replicationMode === 'semi-sync' && readReplicas >= 2) {
    return 'Partition active: one replica is cut off. Writes can continue on ANY 1; the stalled replica may serve stale reads.'
  }
  if (scenario === 'split_primary_replica') {
    return 'Partition active: primary and replicas cannot talk. Writes may stall when replication must wait on standbys.'
  }
  if (scenario === 'split_app_store') {
    return 'Partition active: app-server cannot reach this store until you Heal.'
  }
  if (scenario === 'stall_replica') {
    return 'Partition active: one replica is cut off. Watch lag and stale reads until you Heal.'
  }
  return 'Partition active until you Heal or the server auto-reverts.'
}
