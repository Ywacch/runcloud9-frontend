import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  showCacheVsDatabase,
  showDbConsistencyTradeoff,
  showDbReplicaLag,
  showMonotonicPolicyLine,
  showObserverCanary,
  showRywPolicyLine,
  showStaleReplicaReads,
  type InspectorCapabilities,
} from './inspectorCapabilities'
import {
  failoverFactForComponent,
  partitionFactForComponent,
  type SessionFacts,
} from './sessionFacts'

export type InspectorLayer = 'exception' | 'now' | 'tradeoff' | 'internals'
export type InspectorFamily = 'red' | 'use' | 'pattern' | 'consistency'
export type InspectorComponent =
  | 'loadgen'
  | 'lb'
  | 'app-server'
  | 'cache'
  | 'db'
  | 'mq'
  | 'worker'

export interface InspectorBlockDef {
  id: string
  component: InspectorComponent
  layer: InspectorLayer
  family: InspectorFamily
  requires: (cap: InspectorCapabilities, facts: SessionFacts) => boolean
  promoteWhen?: (
    cap: InspectorCapabilities,
    m: MetricsBucket,
    facts: SessionFacts,
  ) => boolean
  emptyState?: 'no-traffic' | 'em-dash'
}

const LAYER_ORDER: InspectorLayer[] = [
  'internals',
  'tradeoff',
  'now',
  'exception',
]

/** Resolved layer after optional promotion (never demotes). */
export function resolvedBlockLayer(
  block: InspectorBlockDef,
  cap: InspectorCapabilities,
  m: MetricsBucket,
  facts: SessionFacts,
): InspectorLayer {
  if (!block.promoteWhen?.(cap, m, facts)) return block.layer
  const idx = LAYER_ORDER.indexOf(block.layer)
  if (idx < 0 || idx >= LAYER_ORDER.length - 1) return block.layer
  return LAYER_ORDER[idx + 1]
}

export function visibleInspectorBlocks(
  blocks: InspectorBlockDef[],
  cap: InspectorCapabilities,
  facts: SessionFacts,
): InspectorBlockDef[] {
  return blocks.filter((b) => b.requires(cap, facts))
}

export function groupInspectorBlocksByLayer(
  blocks: InspectorBlockDef[],
  cap: InspectorCapabilities,
  m: MetricsBucket,
  facts: SessionFacts,
): Record<InspectorLayer, InspectorBlockDef[]> {
  const grouped: Record<InspectorLayer, InspectorBlockDef[]> = {
    exception: [],
    now: [],
    tradeoff: [],
    internals: [],
  }
  for (const block of visibleInspectorBlocks(blocks, cap, facts)) {
    grouped[resolvedBlockLayer(block, cap, m, facts)].push(block)
  }
  return grouped
}

/** Db panel blocks — metadata for §3.5; render targets stay in StorageIoSection for now. */
export const DB_INSPECTOR_BLOCKS: InspectorBlockDef[] = [
  {
    id: 'db.activity',
    component: 'db',
    layer: 'now',
    family: 'red',
    requires: () => true,
    emptyState: 'em-dash',
  },
  {
    id: 'db.pattern-bridge',
    component: 'db',
    layer: 'now',
    family: 'pattern',
    requires: () => true,
  },
  {
    id: 'db.load',
    component: 'db',
    layer: 'now',
    family: 'use',
    requires: () => true,
    emptyState: 'em-dash',
  },
  {
    id: 'db.replica-lag',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (cap) => showDbReplicaLag(cap),
  },
  {
    id: 'db.consistency-tradeoff',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (cap, facts) => showDbConsistencyTradeoff(cap, facts),
  },
  {
    id: 'db.after-failover',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (_cap, facts) => failoverFactForComponent(facts, 'db') != null,
  },
  {
    id: 'db.stale-replica-reads',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (cap) => showStaleReplicaReads(cap),
  },
  {
    id: 'db.ryw-policy',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (cap) => showRywPolicyLine(cap),
  },
  {
    id: 'db.monotonic-policy',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (cap) => showMonotonicPolicyLine(cap),
  },
  {
    id: 'db.cache-vs-database',
    component: 'db',
    layer: 'tradeoff',
    family: 'consistency',
    requires: (cap) => showCacheVsDatabase(cap),
  },
  {
    id: 'db.partition',
    component: 'db',
    layer: 'exception',
    family: 'consistency',
    requires: (_cap, facts) => partitionFactForComponent(facts, 'db') != null,
  },
  {
    id: 'db.cluster-resources',
    component: 'db',
    layer: 'internals',
    family: 'use',
    requires: () => true,
  },
  {
    id: 'db.observer-canary',
    component: 'db',
    layer: 'internals',
    family: 'consistency',
    requires: (cap) => showObserverCanary(cap),
  },
  {
    id: 'db.diagnostics',
    component: 'db',
    layer: 'internals',
    family: 'use',
    requires: () => true,
  },
]
