import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  cacheInspectorLayerIds,
  cacheLayerSectionLabels,
  isLayeredCache,
} from './cacheLayerDisplay'

function cacheBucket(partial: Partial<MetricsBucket>): MetricsBucket {
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
    storageEngine: 'redis',
    storageRole: '',
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
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

describe('cacheLayerDisplay', () => {
  it('detects layered cache from mode or layers array', () => {
    expect(isLayeredCache(cacheBucket({ cacheMetricMode: 'layered', layers: [] }))).toBe(
      true,
    )
    expect(
      isLayeredCache(
        cacheBucket({
          layers: [
            {
              id: 'redis-internal',
              role: 'backing-store',
              engine: 'redis',
              cpuUsage: 0.1,
              memoryBytes: 1,
              cpuLimit: 0.5,
              memoryLimit: 512,
              cpuIsEstimated: false,
              memIsEstimated: false,
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(isLayeredCache(cacheBucket({ cacheMetricMode: 'keyspace hits/misses' }))).toBe(
      false,
    )
  })

  it('returns layer section labels for backing store and proxy', () => {
    expect(
      cacheLayerSectionLabels({
        id: 'redis-internal',
        role: 'backing-store',
        engine: 'redis',
        cpuUsage: 0,
        memoryBytes: 0,
        cpuLimit: 0,
        memoryLimit: 0,
        cpuIsEstimated: false,
        memIsEstimated: false,
      }).title,
    ).toBe('Redis backing store')
    expect(
      cacheLayerSectionLabels({
        id: 'cache-proxy',
        role: 'sidecar',
        engine: 'caching-proxy',
        cpuUsage: 0,
        memoryBytes: 0,
        cpuLimit: 0,
        memoryLimit: 0,
        cpuIsEstimated: false,
        memIsEstimated: false,
      }).title,
    ).toBe('Cache proxy')
  })

  it('lists inspector layer ids only when layered', () => {
    const layered = cacheBucket({
      cacheMetricMode: 'layered',
      layers: [
        {
          id: 'redis-internal',
          role: 'backing-store',
          engine: 'redis',
          cpuUsage: 0.12,
          memoryBytes: 1,
          cpuLimit: 0.5,
          memoryLimit: 512,
          cpuIsEstimated: false,
          memIsEstimated: false,
        },
        {
          id: 'cache-proxy',
          role: 'sidecar',
          engine: 'caching-proxy',
          cpuUsage: 0.05,
          memoryBytes: 1,
          cpuLimit: 0.25,
          memoryLimit: 256,
          cpuIsEstimated: false,
          memIsEstimated: false,
        },
      ],
    })
    expect(cacheInspectorLayerIds(layered)).toEqual([
      'redis-internal',
      'cache-proxy',
    ])
    expect(cacheInspectorLayerIds(cacheBucket({}))).toEqual([])
  })
})
