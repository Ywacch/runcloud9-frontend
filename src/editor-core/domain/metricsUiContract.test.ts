import { describe, expect, it } from 'vitest'
import {
  parseCrashContext,
  parseComponentLayers,
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
        cpuUsage: 0.05,
        errorRate: 0.01,
      },
    ])
    expect(pods).toHaveLength(1)
    expect(pods[0].p99LatencyMs).toBeCloseTo(20)
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
        restartCount: 5,
      },
    ])
    expect(layers).toHaveLength(2)
    expect(layers[0].id).toBe('redis-internal')
    expect(layers[1].id).toBe('cache-proxy')
    expect(layers[0].redisOpsPerSec).toBe(21000)
    expect(layers[0].restartCount).toBe(5)
    expect(layers[1].restartCount).toBe(1)
  })

  it('parseComponentLayers returns empty for missing input', () => {
    expect(parseComponentLayers(undefined)).toEqual([])
    expect(parseComponentLayers([])).toEqual([])
  })
})
