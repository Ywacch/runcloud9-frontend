import { describe, expect, it } from 'vitest'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  DB_LAYER_ID_POSTGRES_PRIMARY,
  dbHasReplicaLayers,
  dbInstanceTabs,
  introspectRoutingForInstance,
  nodeSupportsInstanceScope,
} from './dbInstanceScope'

function dbNode(readReplicas: number): CanvasNode {
  return {
    id: 'db1',
    type: 'database',
    position: [0, 0, 0],
    label: 'Database',
    config: { readReplicas },
    status: 'healthy',
  }
}

const replicaLayers: ComponentLayerMetrics[] = [
  {
    id: DB_LAYER_ID_POSTGRES_PRIMARY,
    role: 'primary',
    engine: 'postgresql',
    cpuUsage: 0.1,
    memoryBytes: 1,
    cpuLimit: 1,
    memoryLimit: 1,
    cpuIsEstimated: false,
    memIsEstimated: false,
  },
  {
    id: 'postgres-replica-roll',
    role: 'replica',
    engine: 'postgresql',
    cpuUsage: 0.02,
    memoryBytes: 1,
    cpuLimit: 1,
    memoryLimit: 1,
    cpuIsEstimated: false,
    memIsEstimated: false,
    replicationLagSeconds: 0.05,
  },
]

describe('dbInstanceScope', () => {
  it('hides tabs when no replica layers exist', () => {
    expect(dbHasReplicaLayers([replicaLayers[0]!])).toBe(false)
    expect(dbInstanceTabs([replicaLayers[0]!])).toEqual([])
  })

  it('builds cluster, primary, and replica tabs', () => {
    expect(dbInstanceTabs(replicaLayers).map((tab) => tab.label)).toEqual([
      'Cluster',
      'Primary',
      'replica-roll',
    ])
  })

  it('routes replica instance to layerId introspect query', () => {
    expect(introspectRoutingForInstance('postgres-replica-roll')).toEqual({
      target: 'replica',
      layerId: 'postgres-replica-roll',
    })
    expect(introspectRoutingForInstance('cluster')).toEqual({ target: 'primary' })
    expect(introspectRoutingForInstance(DB_LAYER_ID_POSTGRES_PRIMARY)).toEqual({
      target: 'primary',
    })
  })

  it('enables instance scope for database with read replicas configured', () => {
    expect(nodeSupportsInstanceScope(dbNode(2))).toBe(true)
    expect(nodeSupportsInstanceScope(dbNode(0))).toBe(false)
  })
})
