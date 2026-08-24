import { describe, expect, it } from 'vitest'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  DB_LAYER_ID_POSTGRES_PRIMARY,
  dbHasReplicaLayers,
  dbInstanceTabs,
  instanceTabsForNode,
  introspectRoutingForInstance,
  logLineMatchesInstance,
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

function computeNode(): CanvasNode {
  return {
    id: 'app1',
    type: 'compute',
    position: [0, 0, 0],
    label: 'App',
    config: { replicas: 2 },
    status: 'healthy',
  }
}

function metrics(overrides: Partial<MetricsBucket> = {}): MetricsBucket {
  return {
    podReplicas: [],
    layers: [],
    ...overrides,
  } as MetricsBucket
}

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

  it('builds compute tabs when multiple pod replicas exist', () => {
    const tabs = instanceTabsForNode(
      computeNode(),
      metrics({
        podReplicas: [
          {
            name: 'app-server-roll-abc',
            ready: true,
            requestRate: 1,
            p99LatencyMs: 10,
            totalRequests: 1,
            cpuUsage: 0.1,
            errorRate: 0,
            memoryBytes: 0,
          },
          {
            name: 'app-server-roll-def',
            ready: true,
            requestRate: 2,
            p99LatencyMs: 12,
            totalRequests: 2,
            cpuUsage: 0.2,
            errorRate: 0,
            memoryBytes: 0,
          },
        ],
      }),
    )
    expect(tabs.map((tab) => tab.label)).toEqual([
      'Cluster',
      'roll-abc',
      'roll-def',
    ])
  })

  it('returns no tabs for single-pod compute or cache without replicas', () => {
    expect(
      instanceTabsForNode(
        computeNode(),
        metrics({
          podReplicas: [
            {
              name: 'app-server-roll-only',
              ready: true,
              requestRate: 1,
              p99LatencyMs: 10,
              totalRequests: 1,
              cpuUsage: 0.1,
              errorRate: 0,
              memoryBytes: 0,
            },
          ],
        }),
      ),
    ).toEqual([])
    expect(
      instanceTabsForNode(
        {
          id: 'cache1',
          type: 'cache',
          position: [0, 0, 0],
          label: 'Cache',
          config: {},
          status: 'healthy',
        },
        metrics(),
      ),
    ).toEqual([])
  })

  it('keeps database tabs unchanged when replica layers exist', () => {
    expect(instanceTabsForNode(dbNode(2), metrics({ layers: replicaLayers }))).toEqual(
      dbInstanceTabs(replicaLayers),
    )
  })

  it('matches log pods to the selected instance without mixing postgres roles', () => {
    expect(logLineMatchesInstance('app-server-roll-abc', 'cluster')).toBe(true)
    expect(logLineMatchesInstance('app-server-roll-abc', null)).toBe(true)
    expect(
      logLineMatchesInstance('app-server-roll-abc', 'app-server-roll-abc'),
    ).toBe(true)
    expect(
      logLineMatchesInstance('app-server-roll-def', 'app-server-roll-abc'),
    ).toBe(false)
    expect(logLineMatchesInstance('postgres-abc123', DB_LAYER_ID_POSTGRES_PRIMARY)).toBe(
      true,
    )
    expect(
      logLineMatchesInstance('postgres-replica-xyz', DB_LAYER_ID_POSTGRES_PRIMARY),
    ).toBe(false)
    expect(
      logLineMatchesInstance('postgres-replica-xyz', 'postgres-replica-xyz'),
    ).toBe(true)
    expect(logLineMatchesInstance(undefined, 'app-server-roll-abc')).toBe(false)
  })
})
