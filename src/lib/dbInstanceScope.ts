import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { clampReadReplicas } from './replicaConfig'
import { compactPodName } from './replicaMetricsDisplay'

/** Primary postgres layer id on the metrics wire (matches ganymede dbLayerIDPostgresPrimary). */
export const DB_LAYER_ID_POSTGRES_PRIMARY = 'postgres'

export type SelectedInstanceId = string | 'cluster' | null

export function dbHasReplicaLayers(layers: ComponentLayerMetrics[]): boolean {
  return layers.some((layer) => layer.role === 'replica')
}

export function nodeSupportsInstanceScope(node: CanvasNode | null | undefined): boolean {
  if (!node) return false
  if (node.type === 'compute') return true
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
