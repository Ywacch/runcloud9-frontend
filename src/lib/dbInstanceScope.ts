import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { clampReadReplicas } from './replicaConfig'
import { compactPodName } from './replicaMetricsDisplay'

/** Primary postgres layer id on the metrics wire (matches ganymede dbLayerIDPostgresPrimary). */
export const DB_LAYER_ID_POSTGRES_PRIMARY = 'postgres'

export type SelectedInstanceId = string | 'cluster' | null

export function dbHasReplicaLayers(layers: ComponentLayerMetrics[]): boolean {
  return layers.some((layer) => layer.role === 'replica')
}

/** App-server and worker share podReplica instance ids (not DB layers). */
export function usesPodReplicaScope(node: CanvasNode | null | undefined): boolean {
  return node?.type === 'compute' || node?.type === 'worker'
}

export function nodeSupportsInstanceScope(node: CanvasNode | null | undefined): boolean {
  if (!node) return false
  if (usesPodReplicaScope(node)) return true
  if (node.type === 'database') return clampReadReplicas(node.config.readReplicas) >= 1
  return false
}

export function defaultSelectedInstanceId(
  node: CanvasNode | null | undefined,
): SelectedInstanceId {
  return nodeSupportsInstanceScope(node) ? 'cluster' : null
}

export type DbInstanceTab = {
  id: SelectedInstanceId
  label: string
}

export function dbInstanceTabs(layers: ComponentLayerMetrics[]): DbInstanceTab[] {
  const replicas = layers.filter((layer) => layer.role === 'replica')
  if (replicas.length === 0) return []
  return [
    { id: 'cluster', label: 'Cluster' },
    { id: DB_LAYER_ID_POSTGRES_PRIMARY, label: 'Primary' },
    ...replicas.map((layer) => ({
      id: layer.id,
      label: compactPodName(layer.id) || layer.id,
    })),
  ]
}

function podReplicaTabs(metrics: MetricsBucket): DbInstanceTab[] {
  if (metrics.podReplicas.length <= 1) return []
  return [
    { id: 'cluster', label: 'Cluster' },
    ...metrics.podReplicas
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pod) => ({
        id: pod.name,
        label: compactPodName(pod.name) || pod.name,
      })),
  ]
}

/** Inspector Cluster | instance tabs when per-pod/layer metrics exist. */
export function instanceTabsForNode(
  node: CanvasNode | null | undefined,
  metrics: MetricsBucket | undefined,
): DbInstanceTab[] {
  if (!node || !metrics) return []
  if (node.type === 'database') return dbInstanceTabs(metrics.layers)
  if (metrics.podReplicas.length > 1) return podReplicaTabs(metrics)
  return []
}

export function findDbLayer(
  layers: ComponentLayerMetrics[],
  instanceId: string,
): ComponentLayerMetrics | undefined {
  if (instanceId === DB_LAYER_ID_POSTGRES_PRIMARY) {
    return layers.find(
      (layer) =>
        layer.id === DB_LAYER_ID_POSTGRES_PRIMARY || layer.role === 'primary',
    )
  }
  return layers.find((layer) => layer.id === instanceId)
}

export type IntrospectInstanceRouting = {
  target: 'primary' | 'replica'
  layerId?: string
}

/** Map inspector instance selection to introspect query params. */
export function introspectRoutingForInstance(
  instanceId: SelectedInstanceId,
): IntrospectInstanceRouting {
  if (!instanceId || instanceId === 'cluster' || instanceId === DB_LAYER_ID_POSTGRES_PRIMARY) {
    return { target: 'primary' }
  }
  return { target: 'replica', layerId: instanceId }
}

const POSTGRES_REPLICA_POD_PREFIX = 'postgres-replica'

/**
 * True when a k8s pod name belongs to the inspector instance tab.
 * Cluster / null matches everything. Primary (`postgres`) matches the
 * primary Deployment pods, not `postgres-replica-*`.
 */
export function logLineMatchesInstance(
  pod: string | undefined,
  instanceId: SelectedInstanceId,
): boolean {
  if (!instanceId || instanceId === 'cluster') return true
  if (!pod) return false
  if (pod === instanceId) return true
  if (instanceId === DB_LAYER_ID_POSTGRES_PRIMARY) {
    return (
      pod === DB_LAYER_ID_POSTGRES_PRIMARY ||
      (pod.startsWith(`${DB_LAYER_ID_POSTGRES_PRIMARY}-`) &&
        !pod.startsWith(POSTGRES_REPLICA_POD_PREFIX))
    )
  }
  return pod.startsWith(`${instanceId}-`)
}
