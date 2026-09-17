import { describe, expect, it } from 'vitest'
import {
  layerResourcePercents,
  parseCrashContext,
  parseComponentLayers,
  parseDbConsistency,
  parseLoadgenIntervals,
  parsePodReplicas,
  parseRuntimeHealth,
  parseSteadyState,
  parseStorageIo,
  sampleFromWsPayload,
} from './metricsUiContract'

describe('metricsUiContract', () => {
  it('parseSteadyState reads snake_case medians', () => {
    const s = parseSteadyState({
      steady_p99_ms: 12.5,
      steady_rps: 48.2,
      steady_db_query_rate: 3.1,
      steady_cache_hit_rate: 87,
      snapshot_count: 42,
    })
    expect(s).toEqual({
      steadyP99Ms: 12.5,
      steadyRps: 48.2,
      steadyDbQueryRate: 3.1,
      steadyCacheHitRate: 87,
      snapshotCount: 42,
    })
  })

  it('parseLoadgenIntervals caps at 12 buckets', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      t: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      p99Ms: i,
      actualRps: i + 1,
    }))
    const out = parseLoadgenIntervals(rows)
    expect(out).toHaveLength(12)
    expect(out[0].actualRps).toBe(4)
  })

  it('parsePodReplicas converts p99 seconds to ms', () => {
    const pods = parsePodReplicas([
      {
        name: 'app-server-abc-xyz',
        ready: true,
        requestRate: 12.5,
        p99Latency: 0.02,
        p50Latency: 0.01,
        p95Latency: 0.015,
        p50Latency9m: 0.011,
        p95Latency9m: 0.014,
        p99Latency9m: 0.019,
        totalRequests: 500,
        totalErrors9m: 3,
        cpuUsage: 0.05,
        errorRate: 0.01,
      },
    ])
    expect(pods).toHaveLength(1)
    expect(pods[0].p99LatencyMs).toBeCloseTo(20)
    expect(pods[0].p50LatencyMs).toBeCloseTo(10)
    expect(pods[0].p95LatencyMs).toBeCloseTo(15)
    expect(pods[0].p99Latency9mMs).toBeCloseTo(19)
    expect(pods[0].totalRequests).toBe(500)
    expect(pods[0].totalErrors9m).toBe(3)
    expect(pods[0].requestRate).toBe(12.5)
    expect(pods[0].memoryBytes).toBe(0)
  })

  it('parseStorageIo maps WS storageIo object', () => {
    const io = parseStorageIo({
      readRate: 1200,
      writeRate: 45,
      unit: 'rows/s',
      readLabel: 'Rows scanned/s',
      writeLabel: 'Rows written/s',
      scope: 'all-db-clients',
      footnote: 'Row scans include fanout-worker follower lookups.',
      readLatency: 0.002,
      writeLatency: 0.008,
      bytesUsed: 1_073_741_824,
      bytesLimit: 4_294_967_296,
      errorRate: 0.1,
      source: 'postgres_exporter',
    })
    expect(io).toEqual({
      readRate: 1200,
      writeRate: 45,
      unit: 'rows/s',
      readLabel: 'Rows scanned/s',
      writeLabel: 'Rows written/s',
      scope: 'all-db-clients',
      footnote: 'Row scans include fanout-worker follower lookups.',
      readLatency: 0.002,
      writeLatency: 0.008,
      bytesUsed: 1_073_741_824,
      bytesLimit: 4_294_967_296,
      errorRate: 0.1,
      source: 'postgres_exporter',
    })
  })

  it('sampleFromWsPayload converts app-server seconds to ms', () => {
    const sample = sampleFromWsPayload('2026-03-22T22:56:09Z', {
      'app-server': {
        requestRate: 48,
        p99Latency: 0.0125,
        cacheHits: 0.1,
        cacheMisses: 0.02,
      },
      db: { dbQueryRate: 3.5 },
    })
    expect(sample).not.toBeNull()
    expect(sample!.appP99Ms).toBeCloseTo(12.5)
    expect(sample!.appRps).toBe(48)
    expect(sample!.dbQueryRate).toBe(3.5)
    expect(sample!.cacheHits).toBe(0.1)
  })

  it('parseRuntimeHealth maps pod restart fields', () => {
    const rh = parseRuntimeHealth({
      unreadyCount: 1,
      restarting: true,
      pods: [
        {
          name: 'redis-internal-abc',
          ready: false,
          restartCount: 3,
          waitingReason: 'CrashLoopBackOff',
          lastTerminationReason: 'OOMKilled',
          exitCode: 137,
        },
      ],
    })
    expect(rh).toEqual({
      unreadyCount: 1,
      restarting: true,
      pods: [
        {
          name: 'redis-internal-abc',
          ready: false,
          restartCount: 3,
          waitingReason: 'CrashLoopBackOff',
          lastTerminationReason: 'OOMKilled',
          exitCode: 137,
        },
      ],
    })
  })

  it('parseCrashContext maps metric snapshot fields', () => {
    const ctx = parseCrashContext({
      pod: 'redis-internal-abc',
      terminationReason: 'OOMKilled',
      memPercent: 98.2,
      redisRejectedRate: 140,
      redisOpsPerSec: 21000,
    })
    expect(ctx).toMatchObject({
      pod: 'redis-internal-abc',
      terminationReason: 'OOMKilled',
      memPercent: 98.2,
      redisRejectedRate: 140,
      redisOpsPerSec: 21000,
    })
  })

  it('parseComponentLayers maps two-layer proxy cache fixture', () => {
    const layers = parseComponentLayers([
      {
        id: 'cache-proxy',
        role: 'sidecar',
        engine: 'caching-proxy',
        cpuUsage: 0.05,
        memoryUsage: 67108864,
        cpuLimit: 0.25,
        memoryLimit: 134217728,
        restartCount: 1,
      },
      {
        id: 'redis-internal',
        role: 'backing-store',
        engine: 'redis',
        cpuUsage: 0.12,
        memoryUsage: 134217728,
        cpuLimit: 0.5,
        memoryLimit: 536870912,
        redisOpsPerSec: 21000,
        redisKeyspaceHits: 800,
        redisKeyspaceMisses: 120,
        redisRejectedRate: 3,
        evictionsPerSec: 2.5,
        expirationsPerSec: 0.75,
        restartCount: 5,
      },
    ])
    expect(layers).toHaveLength(2)
    expect(layers[0].id).toBe('redis-internal')
    expect(layers[1].id).toBe('cache-proxy')
    expect(layers[0].redisOpsPerSec).toBe(21000)
    expect(layers[0].restartCount).toBe(5)
    expect(layers[1].restartCount).toBe(1)
    // Store lifecycle rates live on the backing-store layer only.
    expect(layers[0].evictionsPerSec).toBe(2.5)
    expect(layers[0].expirationsPerSec).toBe(0.75)
    expect(layers[1].evictionsPerSec).toBeUndefined()
    expect(layers[1].expirationsPerSec).toBeUndefined()
  })

  it('parseComponentLayers returns empty for missing input', () => {
    expect(parseComponentLayers(undefined)).toEqual([])
    expect(parseComponentLayers([])).toEqual([])
  })

  it('parseComponentLayers maps db primary and replica layers with replay lag', () => {
    const layers = parseComponentLayers([
      {
        id: 'postgres-replica-roll',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0.02,
        memoryUsage: 67108864,
        replicationLagSeconds: 0.05,
      },
      {
        id: 'postgres',
        role: 'primary',
        engine: 'postgresql',
        cpuUsage: 0.08,
        memoryUsage: 134217728,
        requestRate: 18,
      },
    ])
    expect(layers).toHaveLength(2)
    expect(layers[0].id).toBe('postgres')
    expect(layers[0].role).toBe('primary')
    expect(layers[0].requestRate).toBe(18)
    expect(layers[1].id).toBe('postgres-replica-roll')
    expect(layers[1].replicationLagSeconds).toBe(0.05)
  })

  it('parseComponentLayers maps promotion preview fields on replica layers', () => {
    const layers = parseComponentLayers([
      {
        id: 'postgres-replica-1',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0,
        memoryUsage: 0,
        syncState: 'sync',
        lagBytes: 0,
        promotionCandidate: true,
      },
    ])
    expect(layers[0]?.syncState).toBe('sync')
    expect(layers[0]?.lagBytes).toBe(0)
    expect(layers[0]?.promotionCandidate).toBe(true)
  })

  it('parseComponentLayers preserves zero replication lag', () => {
    const layers = parseComponentLayers([
      {
        id: 'postgres-replica-0',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0,
        memoryUsage: 0,
        replicationLagSeconds: 0,
      },
    ])
    expect(layers[0]?.replicationLagSeconds).toBe(0)
  })

  it('parseComponentLayers maps connectedOnPrimary false on disconnected replica', () => {
    const layers = parseComponentLayers([
      {
        id: 'postgres-replica-0',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0,
        memoryUsage: 0,
        connectedOnPrimary: false,
        promotionCandidate: false,
      },
      {
        id: 'postgres-replica-1',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0,
        memoryUsage: 0,
        connectedOnPrimary: true,
        replicationLagSeconds: 0,
        lagBytes: 0,
        syncState: 'sync',
        promotionCandidate: true,
      },
    ])
    expect(layers[0]?.connectedOnPrimary).toBe(false)
    expect(layers[0]?.promotionCandidate).toBeUndefined()
    expect(layers[1]?.connectedOnPrimary).toBe(true)
    expect(layers[1]?.replicationLagSeconds).toBe(0)
    expect(layers[1]?.promotionCandidate).toBe(true)
  })

  it('parseComponentLayers maps db layer engine totals and storageIo', () => {
    const layers = parseComponentLayers([
      {
        id: 'postgres-replica-scan',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0.03,
        memoryUsage: 67108864,
        requestRate: 12.5,
        totalRequests: 4200,
        dbActiveConnections: 1,
        storageIo: {
          readRate: 18,
          writeRate: 0,
          readTotal9m: 900,
          unit: 'rows/s',
          source: 'postgres_exporter',
        },
      },
    ])
    expect(layers[0]?.totalRequests).toBe(4200)
    expect(layers[0]?.dbActiveConnections).toBe(1)
    expect(layers[0]?.storageIo?.readTotal9m).toBe(900)
    expect(layers[0]?.storageIo?.writeRate).toBe(0)
  })

  it('parseComponentLayers maps db layer app SQL fields', () => {
    const layers = parseComponentLayers([
      {
        id: 'postgres',
        role: 'primary',
        engine: 'postgresql',
        cpuUsage: 0.08,
        memoryUsage: 134217728,
        dbQueryRate: 5.8,
        dbTotalQueries: 993,
        p50Latency: 0.05,
        p95Latency: 0.12,
        p99Latency: 0.834,
        p50Latency9m: 0.04,
        p95Latency9m: 0.1,
        p99Latency9m: 0.7,
      },
      {
        id: 'postgres-replica-0',
        role: 'replica',
        engine: 'postgresql',
        cpuUsage: 0.02,
        memoryUsage: 67108864,
        dbQueryRate: 3.9,
        dbTotalQueries: 673,
        p99Latency: 0.223,
      },
    ])
    expect(layers[0]?.dbQueryRate).toBe(5.8)
    expect(layers[0]?.dbTotalQueries).toBe(993)
    expect(layers[0]?.p99LatencyMs).toBeCloseTo(834)
    expect(layers[0]?.p50Latency9mMs).toBeCloseTo(40)
    expect(layers[1]?.dbQueryRate).toBe(3.9)
    expect(layers[1]?.p99LatencyMs).toBeCloseTo(223)
  })

  it('parseDbConsistency maps observer status from WS payload', () => {
    const status = parseDbConsistency({
      leaderReads: 120,
      replicaReads: 380,
      replicaStaleReads: 15,
      guaranteeHeldBy: 'app',
      rywViolations: 2,
      monotonicViolations: 1,
      cacheDbStale: 0,
      replicaStalenessVersions: 3,
      lastProbeError: 'dial primary: timeout',
    })
    expect(status).toEqual({
      leaderReads: 120,
      replicaReads: 380,
      replicaStaleReads: 15,
      guaranteeHeldBy: 'app',
      rywViolations: 2,
      monotonicViolations: 1,
      cacheDbStale: 0,
      replicaStalenessVersions: 3,
      lastProbeError: 'dial primary: timeout',
    })
    expect(parseDbConsistency(null)).toBeNull()
  })

  it('parseDbConsistency defaults traffic counters to zero', () => {
    const status = parseDbConsistency({
      rywViolations: 0,
      monotonicViolations: 0,
      cacheDbStale: 0,
      replicaStalenessVersions: 0,
    })
    expect(status).toEqual({
      leaderReads: 0,
      replicaReads: 0,
      replicaStaleReads: 0,
      guaranteeHeldBy: undefined,
      rywViolations: 0,
      monotonicViolations: 0,
      cacheDbStale: 0,
      replicaStalenessVersions: 0,
    })
  })

  it('parseDbConsistency maps cache evidence fields', () => {
    const status = parseDbConsistency({
      cacheDbStale: 1,
      rywViolations: 0,
      monotonicViolations: 0,
      replicaStalenessVersions: 0,
      lastCacheKey: 'product:42',
      lastCacheServed: '5',
      lastCacheTruth: '2',
      lastCacheRequestId: 'req-abc',
    })
    expect(status).toEqual({
      leaderReads: 0,
      replicaReads: 0,
      replicaStaleReads: 0,
      guaranteeHeldBy: undefined,
      rywViolations: 0,
      monotonicViolations: 0,
      cacheDbStale: 1,
      replicaStalenessVersions: 0,
      lastCacheKey: 'product:42',
      lastCacheServed: '5',
      lastCacheTruth: '2',
      lastCacheRequestID: 'req-abc',
    })
  })

  it('layerResourcePercents keeps idle millicores instead of rounding to 0%', () => {
    const { cpuPercent, memPercent } = layerResourcePercents({
      id: 'postgres',
      role: 'primary',
      engine: 'postgresql',
      cpuUsage: 0.015,
      cpuLimit: 2,
      memoryBytes: 80 * 1024 * 1024,
      memoryLimit: 2 * 1024 * 1024 * 1024,
      cpuIsEstimated: false,
      memIsEstimated: false,
    })
    expect(cpuPercent).toBe(0.8)
    expect(memPercent).toBeGreaterThan(0)
  })
})
