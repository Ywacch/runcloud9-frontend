import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ComponentLayerMetrics, PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  ComputeInstanceSection,
  DbConsistencySection,
  DbInstanceLayerSection,
  DbLoadSection,
  DbReplicaLagSection,
  formatConsistencyViolation,
} from './StorageIoSection'

function dbBucket(
  consistency?: MetricsBucket['consistency'],
  extras: Partial<MetricsBucket> = {},
): MetricsBucket {
  return {
    cpuUsage: 0,
    cpuPercent: 0,
    memoryBytes: 0,
    memPercent: 0,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0,
    memoryLimit: 0,
    requestRate: 0,
    errorRate: 0,
    totalRequests: 0,
    totalErrors9m: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    p50Latency9m: 0,
    p95Latency9m: 0,
    p99Latency9m: 0,
    avgLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitsLast9m: 0,
    cacheMissesLast9m: 0,
    dbQueryRate: 0,
    dbTotalQueries: 0,
    dbQueryLatency: 0,
    dbQuerySource: '',
    dbActiveConnections: 0,
    maxConnections: 0,
    storageEngine: 'postgresql',
    storageRole: 'primary',
    storageIo: null,
    activeConnections: 0,
    lbConnectionLimit: 0,
    queueDepth: 0,
    produceRate: 0,
    consumeRate: 0,
    messagesReady: 0,
    messagesUnacked: 0,
    mqMemoryUsed: 0,
    mqMemoryLimit: 0,
    mqSaturationRatio: 0,
    workerSaturation: 0,
    redisMaxClients: 0,
    perBackendRps: {},
    lbAlgorithm: '',
    lbBackends: [],
    podReplicas: [],
    backendPods: [],
    backendReplicas: null,
    runtimeHealth: null,
    layers: [],
    consistency,
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...extras,
  }
}

describe('formatConsistencyViolation', () => {
  it('formats OK and violation counts', () => {
    expect(formatConsistencyViolation(0)).toBe('OK')
    expect(formatConsistencyViolation(1)).toBe('1 violation')
    expect(formatConsistencyViolation(3)).toBe('3 violations')
  })
})

describe('DbConsistencySection', () => {
  it('renders nothing when consistency is absent', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, { m: dbBucket(undefined) }),
    )
    expect(html).toBe('')
  })

  it('renders OK state with offload and policy hint', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 100,
          replicaReads: 300,
          replicaStaleReads: 0,
          guaranteeHeldBy: 'none',
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
        }),
        readConsistencyPolicy: 'replica',
      }),
    )
    expect(html).toContain('Read routing tradeoffs')
    expect(html).toContain('what staying off the leader cost you')
    expect(html).toContain('Read offload')
    expect(html).toContain('75% (300 replica · 100 leader)')
    expect(html).toContain('Stale replica reads')
    expect(html).toContain('RYW violations')
    expect(html).toContain('Held by')
    expect(html).toContain('None requested')
    expect(html).toContain('Observer canary')
    expect(html).toContain('Probe replica lag')
    expect(html).toContain('0 versions')
    expect(html).toContain('stale replica reads are the expected tradeoff')
  })

  it('renders violation counts, stale reads, and probe error', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 50,
          replicaReads: 150,
          replicaStaleReads: 12,
          guaranteeHeldBy: 'app',
          rywViolations: 2,
          monotonicViolations: 1,
          cacheDbStale: 0,
          replicaStalenessVersions: 4,
          lastProbeError: 'dial replica: connection refused',
        }),
        readConsistencyPolicy: 'ryw',
      }),
    )
    expect(html).toContain('75% (150 replica · 50 leader)')
    expect(html).toContain('12 reads')
    expect(html).toContain('App (redirects)')
    expect(html).toContain('2 violations')
    expect(html).toContain('1 violation')
    expect(html).toContain('4 versions')
    expect(html).toContain('dial replica: connection refused')
    expect(html).toContain('redirects hold the guarantee')
  })

  it('renders cache evidence and view trace when present', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 0,
          replicaReads: 0,
          replicaStaleReads: 0,
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 1,
          replicaStalenessVersions: 0,
          lastCacheKey: 'product:7',
          lastCacheServed: '5',
          lastCacheTruth: '2',
          lastCacheRequestID: 'req-stale-1',
        }),
      }),
    )
    expect(html).toContain('product:7')
    expect(html).toContain('served 5')
    expect(html).toContain('db 2')
    expect(html).toContain('View trace')
  })

  it('renders partition CAP readout for async stale reads', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 10,
          replicaReads: 40,
          replicaStaleReads: 5,
          rywViolations: 2,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
          guaranteeHeldBy: 'none',
        }),
        replicationMode: 'async',
        readReplicas: 2,
        partitionCapEvent: {
          timestamp: 't',
          type: 'invariant',
          source: 'detector',
          title: 'Consistency degraded under partition',
          description: '',
          rule: 'partition_stale_reads',
        },
      }),
    )
    expect(html).toContain('Under partition')
    expect(html).toContain('Stale replica reads')
    expect(html).toContain('replica reads went stale')
  })

  it('renders semi-sync remote_apply note while guarantee held by db', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 5,
          replicaReads: 20,
          replicaStaleReads: 3,
          rywViolations: 1,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
          guaranteeHeldBy: 'db',
        }),
        replicationMode: 'semi-sync',
        readReplicas: 2,
        syncCommitLevel: 'remote_apply',
        activePartitionScenario: 'stall_replica',
        partitionCapEvent: {
          timestamp: 't',
          type: 'invariant',
          source: 'detector',
          title: 'Consistency degraded under partition',
          description: '',
          rule: 'partition_stale_reads',
        },
      }),
    )
    expect(html).toContain('acked standby')
    expect(html).toContain('Database')
    expect(html).toContain('ANY 1')
  })

  it('renders sync write stall CAP readout', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 0,
          replicaReads: 0,
          replicaStaleReads: 0,
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
          guaranteeHeldBy: 'none',
        }),
        replicationMode: 'sync',
        readReplicas: 2,
        partitionCapEvent: {
          timestamp: 't',
          type: 'invariant',
          source: 'detector',
          title: 'Writes stalling under partition',
          description: '',
          rule: 'partition_write_stall',
        },
      }),
    )
    expect(html).toContain('Writes stalling')
    expect(html).toContain('Writes stalled while the database waited on replication.')
  })

  it('renders zero-loss promotion readout from chaos_inject', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 10,
          replicaReads: 40,
          replicaStaleReads: 0,
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
          guaranteeHeldBy: 'none',
        }),
        replicationMode: 'semi-sync',
        syncCommitLevel: 'remote_apply',
        promotionChaosEvent: {
          timestamp: 't',
          type: 'action',
          source: 'chaos',
          kind: 'chaos_inject',
          component: 'db',
          title: 'Promote replica',
          description: 'promote_replica',
          detail: {
            scenario: 'promote_replica',
            promotedPod: 'postgres-replica-0',
            candidateSyncState: 'sync',
            candidateLagBytes: '0',
            walBytesLost: '0',
            replicationMode: 'semi-sync',
            syncCommitLevel: 'remote_apply',
          },
        },
      }),
    )
    expect(html).toContain('After failover')
    expect(html).toContain('WAL bytes lost')
    expect(html).toContain('0 B')
    expect(html).toContain('postgres-replica-0')
    expect(html).toContain('remote_apply')
    expect(html).toContain('nothing the client already saw was lost')
    expect(html).not.toContain('Failover write loss')
  })

  it('renders lossy promotion readout with invariant escalation', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 0,
          replicaReads: 0,
          replicaStaleReads: 0,
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
          guaranteeHeldBy: 'none',
        }),
        replicationMode: 'async',
        promotionChaosEvent: {
          timestamp: 't',
          type: 'action',
          source: 'chaos',
          kind: 'chaos_inject',
          component: 'db',
          title: 'Promote lagging replica',
          description: 'promote_lagging_replica',
          detail: {
            scenario: 'promote_lagging_replica',
            promotedPod: 'postgres-replica-1',
            candidateSyncState: 'async',
            candidateLagBytes: '4096',
            walBytesLost: '4096',
            replicationMode: 'async',
            syncCommitLevel: 'on',
          },
        },
        failoverWriteLossEvent: {
          timestamp: 't2',
          type: 'invariant',
          source: 'chaos',
          component: 'db',
          title: 'Failover write loss',
          description:
            'Promoted postgres-replica-1 was 4096 bytes behind the fenced primary; commits the client already saw may be gone',
          rule: 'failover_write_loss',
          detail: {
            scenario: 'promote_lagging_replica',
            promotedPod: 'postgres-replica-1',
            syncState: 'async',
            walBytesLost: '4096',
          },
        },
      }),
    )
    expect(html).toContain('After failover')
    expect(html).toContain('4.0 KB')
    expect(html).toContain('postgres-replica-1')
    expect(html).toContain('farthest-behind standby')
    expect(html).toContain('commits the client already saw may be gone')
  })

  it('renders standby reclone hints after failover', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 10,
          replicaReads: 40,
          replicaStaleReads: 0,
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
          guaranteeHeldBy: 'none',
        }),
        replicationMode: 'semi-sync',
        syncCommitLevel: 'remote_apply',
        promotionChaosEvent: {
          timestamp: 't',
          type: 'action',
          source: 'chaos',
          kind: 'chaos_inject',
          component: 'db',
          title: 'Promote replica',
          description: 'promote_replica',
          detail: {
            scenario: 'promote_replica',
            promotedPod: 'postgres-replica-0',
            candidateSyncState: 'sync',
            candidateLagBytes: '0',
            walBytesLost: '0',
          },
        },
        standbyRecloneEvent: {
          timestamp: 't2',
          type: 'action',
          source: 'chaos',
          kind: 'standby_reclone',
          component: 'db',
          audience: 'both',
          title: 'Standby rebuilt after timeline fork',
          description: 'standby_reclone',
          detail: {
            status: 'partial',
            promotedPod: 'postgres-replica-0',
            reclonedPods: 'postgres-replica-1',
            pendingPods: 'postgres-replica-2',
          },
        },
      }),
    )
    expect(html).toContain('After failover')
    expect(html).toContain(
      'postgres-replica-1 were ahead of the new primary and had to be rebuilt from db.',
    )
    expect(html).toContain(
      'postgres-replica-2 are still rebuilding; lag will stay high until streaming.',
    )
  })

  it('hides cache evidence line when key is absent', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          leaderReads: 0,
          replicaReads: 0,
          replicaStaleReads: 0,
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 1,
          replicaStalenessVersions: 0,
        }),
      }),
    )
    expect(html).not.toContain('View trace')
    expect(html).not.toContain('· db ')
  })
})

const instancePod: PodReplicaMetrics = {
  name: 'app-server-roll-a',
  ready: true,
  requestRate: 25,
  p99LatencyMs: 42,
  p50LatencyMs: 10,
  p95LatencyMs: 30,
  p99Latency9mMs: 55,
  totalRequests: 9000,
  totalErrors9m: 12,
  cpuUsage: 0.2,
  errorRate: 0.5,
  memoryBytes: 128 * 1024 * 1024,
}

describe('ComputeInstanceSection timeframe', () => {
  it('shows live request rate and error rate', () => {
    const html = renderToStaticMarkup(
      createElement(ComputeInstanceSection, {
        pod: instancePod,
        m: dbBucket(),
        view: { timeframe: 'live', showGraphs: true, latencyQuantile: 'p99' },
      }),
    )
    expect(html).toContain('Request rate')
    expect(html).toContain('Error rate')
    expect(html).toContain('25')
  })

  it('shows session totals and errors in session mode', () => {
    const html = renderToStaticMarkup(
      createElement(ComputeInstanceSection, {
        pod: instancePod,
        m: dbBucket(),
        view: { timeframe: 'session', showGraphs: true, latencyQuantile: 'p99' },
      }),
    )
    expect(html).toContain('Total requests')
    expect(html).toContain('9,000')
    expect(html).toContain('Errors')
    expect(html).toContain('12')
    expect(html).toContain('Latency ')
    expect(html).toContain('>p99<')
  })
})

describe('ComputeInstanceSection worker labels', () => {
  it('uses process rate and total jobs labels when overridden', () => {
    const html = renderToStaticMarkup(
      createElement(ComputeInstanceSection, {
        pod: instancePod,
        m: dbBucket(),
        view: { timeframe: 'live', showGraphs: true, latencyQuantile: 'p99' },
        liveThroughputLabel: 'Process rate',
        sessionThroughputLabel: 'Total jobs',
      }),
    )
    expect(html).toContain('Process rate')
    expect(html).not.toContain('Request rate')
  })

  it('shows total jobs in session mode when overridden', () => {
    const html = renderToStaticMarkup(
      createElement(ComputeInstanceSection, {
        pod: instancePod,
        m: dbBucket(),
        view: { timeframe: 'session', showGraphs: true, latencyQuantile: 'p99' },
        liveThroughputLabel: 'Process rate',
        sessionThroughputLabel: 'Total jobs',
      }),
    )
    expect(html).toContain('Total jobs')
    expect(html).not.toContain('Total requests')
    expect(html).toContain('9,000')
  })
})

const dbReplicaLayer: ComponentLayerMetrics = {
  id: 'postgres-replica-0',
  role: 'replica',
  engine: 'postgresql',
  cpuUsage: 0.04,
  memoryBytes: 64 * 1024 * 1024,
  cpuLimit: 1,
  memoryLimit: 512 * 1024 * 1024,
  cpuIsEstimated: false,
  memIsEstimated: false,
  dbQueryRate: 3.9,
  dbTotalQueries: 672,
  p99LatencyMs: 1382,
  p99Latency9mMs: 1200,
  requestRate: 8,
  totalRequests: 1200,
  replicationLagSeconds: 0.1,
}

describe('DbInstanceLayerSection timeframe', () => {
  it('shows live app SQL rate and p99 latency', () => {
    const html = renderToStaticMarkup(
      createElement(DbInstanceLayerSection, {
        layer: dbReplicaLayer,
        view: { timeframe: 'live', showGraphs: true, latencyQuantile: 'p99' },
      }),
    )
    expect(html).toContain('Query rate')
    expect(html).toContain('4/s')
    expect(html).toContain('Latency (')
    expect(html).toContain('>p99<')
    expect(html).not.toContain('not shown on Replica tabs yet')
  })

  it('shows session app SQL totals in session mode', () => {
    const html = renderToStaticMarkup(
      createElement(DbInstanceLayerSection, {
        layer: dbReplicaLayer,
        view: { timeframe: 'session', showGraphs: true, latencyQuantile: 'p99' },
      }),
    )
    expect(html).toContain('Total queries')
    expect(html).toContain('672')
    expect(html).toContain('Latency ')
    expect(html).toContain('>p99<')
  })

  it('shows dashes when layer app SQL fields are absent', () => {
    const html = renderToStaticMarkup(
      createElement(DbInstanceLayerSection, {
        layer: {
          ...dbReplicaLayer,
          dbQueryRate: undefined,
          dbTotalQueries: undefined,
          p99LatencyMs: undefined,
          p99Latency9mMs: undefined,
        },
        view: { timeframe: 'live', showGraphs: true, latencyQuantile: 'p99' },
      }),
    )
    expect(html).toContain('Query rate')
    expect(html).toMatch(/>-</)
  })
})

const postgresIo = {
  readRate: 27216,
  writeRate: 8,
  readTotal9m: 1_264_086,
  writeTotal9m: 3576,
  unit: 'rows/s',
  readLabel: 'Rows scanned/s',
  writeLabel: 'Rows written/s',
  readLatency: 0,
  writeLatency: 0,
  bytesUsed: 0,
  bytesLimit: 0,
  errorRate: 0,
  source: 'postgres_exporter',
}

describe('DbLoadSection', () => {
  const liveView = { timeframe: 'live' as const, showGraphs: true, latencyQuantile: 'p99' as const }
  const sessionView = { timeframe: 'session' as const, showGraphs: true, latencyQuantile: 'p99' as const }

  it('shows live rates with /s labels', () => {
    const html = renderToStaticMarkup(
      createElement(DbLoadSection, {
        m: dbBucket(undefined, { storageIo: postgresIo, dbQueryRate: 50 }),
        dbQueryRate: 50,
        templateMetrics: {},
        view: liveView,
      }),
    )
    expect(html).toContain('Rows scanned/s')
    expect(html).toContain('Rows written/s')
    expect(html).toMatch(/27[,.]?216\/s/)
    expect(html).toContain('/s')
  })

  it('shows session totals without /s labels or 10s graphs', () => {
    const html = renderToStaticMarkup(
      createElement(DbLoadSection, {
        m: dbBucket(undefined, { storageIo: postgresIo, dbQueryRate: 50 }),
        dbQueryRate: 50,
        templateMetrics: {},
        view: sessionView,
      }),
    )
    expect(html).toContain('Rows scanned')
    expect(html).not.toContain('Rows scanned/s')
    expect(html).toContain('Rows written')
    expect(html).not.toContain('Rows written/s')
    expect(html).toContain('1,264,086')
    expect(html).toContain('3,576')
    expect(html).not.toContain('27,216/s')
    expect(html).not.toContain('10s · /s')
    expect(html).not.toContain('Why reads look high')
  })
})

describe('DbReplicaLagSection promotion preview', () => {
  it('marks the most-current standby and shows sync state with lag bytes', () => {
    const html = renderToStaticMarkup(
      createElement(DbReplicaLagSection, {
        m: dbBucket(undefined, {
          layers: [
            {
              id: 'postgres',
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
              id: 'postgres-replica-0',
              role: 'replica',
              engine: 'postgresql',
              cpuUsage: 0.1,
              memoryBytes: 1,
              cpuLimit: 1,
              memoryLimit: 1,
              cpuIsEstimated: false,
              memIsEstimated: false,
              replicationLagSeconds: 0.5,
              syncState: 'async',
              lagBytes: 8192,
            },
            {
              id: 'postgres-replica-1',
              role: 'replica',
              engine: 'postgresql',
              cpuUsage: 0.1,
              memoryBytes: 1,
              cpuLimit: 1,
              memoryLimit: 1,
              cpuIsEstimated: false,
              memIsEstimated: false,
              replicationLagSeconds: 0,
              syncState: 'sync',
              lagBytes: 0,
              promotionCandidate: true,
            },
          ],
          backendReplicas: { desired: 2, ready: 2 },
        }),
      }),
    )
    expect(html).toContain('promote_replica')
    expect(html).toContain('postgres-replica-1')
    expect(html).toContain('promote pick')
    expect(html).toContain('sync')
    expect(html).toContain('8.0 KiB')
    expect(html).toContain('0 B')
  })

  it('degrades to async when sync state is absent on a single replica', () => {
    const html = renderToStaticMarkup(
      createElement(DbReplicaLagSection, {
        m: dbBucket(undefined, {
          layers: [
            {
              id: 'postgres-replica-0',
              role: 'replica',
              engine: 'postgresql',
              cpuUsage: 0.1,
              memoryBytes: 1,
              cpuLimit: 1,
              memoryLimit: 1,
              cpuIsEstimated: false,
              memIsEstimated: false,
              replicationLagSeconds: 0.2,
              syncState: 'async',
              lagBytes: 0,
              promotionCandidate: true,
            },
          ],
        }),
      }),
    )
    expect(html).toContain('async')
    expect(html).toContain('0 B behind')
  })
})
