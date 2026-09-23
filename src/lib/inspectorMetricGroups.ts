import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { isLayeredCache } from './cacheLayerDisplay'
import { clampReadReplicas } from './replicaConfig'

export type InspectorMetricGroupId = string

export interface InspectorMetricGroup {
  id: InspectorMetricGroupId
  label: string
}

const COMPUTE_GROUPS: InspectorMetricGroup[] = [
  { id: 'health', label: 'Health' },
  { id: 'internals', label: 'Internals' },
  { id: 'replicas', label: 'Replicas' },
]

const LB_GROUPS: InspectorMetricGroup[] = [
  { id: 'routing', label: 'Routing' },
  { id: 'backends', label: 'Backends' },
  { id: 'internals', label: 'Internals' },
]

const DB_GROUPS: InspectorMetricGroup[] = [
  { id: 'app-load', label: 'App Load' },
  { id: 'engine-work', label: 'Engine Work' },
  { id: 'replication', label: 'Replication' },
  { id: 'tradeoffs', label: 'Tradeoffs' },
]

const CACHE_GROUPS_BASE: InspectorMetricGroup[] = [
  { id: 'hit-rate', label: 'Hit Rate' },
  { id: 'engine', label: 'Engine' },
]

const CACHE_PROXY_GROUP: InspectorMetricGroup = { id: 'proxy', label: 'Proxy' }

const MQ_GROUPS: InspectorMetricGroup[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'flow', label: 'Flow' },
  { id: 'engine', label: 'Engine' },
]

const WORKER_GROUPS: InspectorMetricGroup[] = [
  { id: 'health', label: 'Health' },
  { id: 'internals', label: 'Internals' },
  { id: 'replicas', label: 'Replicas' },
]

export function metricGroupsForNode(
  node: CanvasNode,
  m?: MetricsBucket,
): InspectorMetricGroup[] {
  switch (node.type) {
    case 'compute':
      return filterReplicaGroup(COMPUTE_GROUPS, m)
    case 'load_balancer':
      return LB_GROUPS
    case 'database': {
      const replicas = clampReadReplicas(node.config.readReplicas)
      if (replicas < 1) {
        return DB_GROUPS.filter((g) => g.id !== 'replication')
      }
      return DB_GROUPS
    }
    case 'cache':
      return cacheGroupsForNode(node, m)
    case 'message_queue':
      return MQ_GROUPS
    case 'worker':
      return filterReplicaGroup(WORKER_GROUPS, m)
    default:
      return []
  }
}

function cacheGroupsForNode(
  node: CanvasNode,
  m?: MetricsBucket,
): InspectorMetricGroup[] {
  const strategy = String(node.config.cacheStrategy ?? '').trim().toLowerCase()
  const layered =
    isLayeredCache(m ?? ({} as MetricsBucket)) ||
    strategy === 'write-through' ||
    strategy === 'write-behind' ||
    strategy === 'read-through'
  if (!layered) return CACHE_GROUPS_BASE
  return [...CACHE_GROUPS_BASE, CACHE_PROXY_GROUP]
}

function filterReplicaGroup(
  groups: InspectorMetricGroup[],
  m?: MetricsBucket,
): InspectorMetricGroup[] {
  const replicaCount = m?.podReplicas?.length ?? 0
  if (replicaCount <= 1) {
    return groups.filter((g) => g.id !== 'replicas')
  }
  return groups
}

export function defaultMetricGroupId(node: CanvasNode): InspectorMetricGroupId {
  const groups = metricGroupsForNode(node)
  return groups[0]?.id ?? 'health'
}

export function resolveMetricGroupId(
  node: CanvasNode,
  stored: InspectorMetricGroupId | undefined,
  m?: MetricsBucket,
): InspectorMetricGroupId {
  const groups = metricGroupsForNode(node, m)
  if (groups.length === 0) return stored ?? 'health'
  if (stored && groups.some((g) => g.id === stored)) return stored
  return groups[0].id
}

/** Panel view control visibility per breadcrumb-spec sticky-bar table. */
export function panelViewVisibilityForGroup(groupId: InspectorMetricGroupId): {
  showGraphs: boolean
  showLatency: boolean
  showTimeframe: boolean
} {
  switch (groupId) {
    case 'health':
    case 'app-load':
    case 'flow':
    case 'hit-rate':
    case 'proxy':
    case 'routing':
      return { showGraphs: true, showLatency: true, showTimeframe: true }
    case 'internals':
    case 'engine':
    case 'engine-work':
    case 'backlog':
    case 'backends':
      return { showGraphs: true, showLatency: false, showTimeframe: true }
    case 'replication':
      return { showGraphs: false, showLatency: false, showTimeframe: false }
    case 'replicas':
    case 'tradeoffs':
      return { showGraphs: false, showLatency: false, showTimeframe: true }
    default:
      return { showGraphs: true, showLatency: true, showTimeframe: true }
  }
}
