import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { getTopologyFlags } from './componentRole'
import {
  readConsistencyFromConfig,
  type ReadConsistencyPolicy,
} from './readConsistency'
import {
  clampReadReplicas,
  replicationModeFromConfig,
  type ReplicationMode,
} from './replicaConfig'
import type { SessionFacts } from './sessionFacts'
import { failoverFactForComponent, partitionFactForComponent } from './sessionFacts'

/** Topology + policy inputs for inspector block gating (§1.1). */
export interface InspectorCapabilities {
  hasCache: boolean
  hasWorker: boolean
  hasMq: boolean
  hasLb: boolean
  hasDb: boolean
  readReplicas: number
  lbBackends: number
  replicationMode: ReplicationMode
  readConsistency: ReadConsistencyPolicy
  cacheStrategy: string
  loadgenActive: boolean
}

export function inspectorCapabilities(
  nodes: Record<string, CanvasNode>,
  node: CanvasNode,
  opts: { loadgenActive: boolean; lbBackends?: number },
): InspectorCapabilities {
  const topo = getTopologyFlags(nodes)
  const readReplicas =
    node.type === 'database'
      ? clampReadReplicas(node.config.readReplicas)
      : topo.dbReadReplicas

  return {
    hasCache: topo.hasCache,
    hasWorker: topo.hasWorker,
    hasMq: topo.hasMQ,
    hasLb: topo.hasLB,
    hasDb: topo.hasDB,
    readReplicas,
    lbBackends: opts.lbBackends ?? 0,
    replicationMode:
      node.type === 'database'
        ? replicationModeFromConfig(node.config.replicationMode)
        : 'async',
    readConsistency:
      node.type === 'database'
        ? readConsistencyFromConfig(node.config.readConsistency)
        : topo.readConsistency as ReadConsistencyPolicy,
    cacheStrategy: topo.cacheStrategy,
    loadgenActive: opts.loadgenActive,
  }
}

/** Replica lag / promotion preview — gated on canvas config, not collector layers. */
export function showDbReplicaLag(cap: InspectorCapabilities): boolean {
  return cap.readReplicas >= 1
}

/** Read-routing tradeoff section — topology or policy must justify it. */
export function showDbConsistencyTradeoff(
  cap: InspectorCapabilities,
  facts: SessionFacts,
): boolean {
  if (cap.readReplicas >= 1) return true
  if (failoverFactForComponent(facts, 'db')) return true
  if (partitionFactForComponent(facts, 'db')) return true
  return cap.readConsistency !== 'leader-only'
}

export function showCacheVsDatabase(cap: InspectorCapabilities): boolean {
  return cap.hasCache && cap.hasDb
}

export function showStaleReplicaReads(cap: InspectorCapabilities): boolean {
  return cap.readReplicas >= 1 && cap.readConsistency === 'replica'
}

export function showRywPolicyLine(cap: InspectorCapabilities): boolean {
  return cap.readConsistency === 'ryw' || cap.readConsistency === 'ryw+monotonic'
}

export function showMonotonicPolicyLine(cap: InspectorCapabilities): boolean {
  return (
    cap.readConsistency === 'monotonic' ||
    cap.readConsistency === 'sticky' ||
    cap.readConsistency === 'ryw+monotonic'
  )
}

export function showObserverCanary(cap: InspectorCapabilities): boolean {
  return cap.readReplicas >= 1
}

/** Count LB backends from canvas wiring (not metrics payload). */
export function lbBackendCount(
  backendPods: number,
  perBackendEntries: number,
  canvasBackends: number,
  desiredFromMetrics?: number,
): number {
  return Math.max(backendPods, perBackendEntries, canvasBackends, desiredFromMetrics ?? 0)
}

export function showLbPerBackendDistribution(backendCount: number): boolean {
  return backendCount >= 2
}

export function showLbSingleBackendNudge(
  cap: InspectorCapabilities,
  backendCount: number,
): boolean {
  return cap.hasLb && backendCount === 1
}

/** Legacy redisOpsPerSec row — hidden when storageIo is present (§3.4, §7). */
export function showLegacyRedisOpsRow(
  cap: InspectorCapabilities,
  m: { storageIo?: { readRate?: number } | null; redisOpsPerSec?: number },
  timelineMode: boolean,
): boolean {
  if (!cap.hasCache || !timelineMode) return false
  if ((m.storageIo?.readRate ?? 0) > 0) return false
  return (m.redisOpsPerSec ?? 0) > 0
}

/** Social-feed push: no app hit/miss on timeline path — engine commands headline (§3.4). */
export function showCacheEngineCommandsInNow(
  cap: InspectorCapabilities,
  hasAppHitMissTraffic: boolean,
  timelineMode: boolean,
): boolean {
  return cap.hasCache && timelineMode && !hasAppHitMissTraffic
}

export function showCacheVsDatabaseTradeoff(cap: InspectorCapabilities): boolean {
  return cap.hasCache && cap.hasDb
}
