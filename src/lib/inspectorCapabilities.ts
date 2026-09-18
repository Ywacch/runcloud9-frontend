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
    hasMq: topo.hasMq,
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
  return cap.readConsistency === 'monotonic' || cap.readConsistency === 'ryw+monotonic'
}

export function showObserverCanary(cap: InspectorCapabilities): boolean {
  return cap.readReplicas >= 1
}
