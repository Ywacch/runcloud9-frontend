import { beforeEach, describe, expect, it } from 'vitest'
import { parseRecentLatenciesMs, parseResourceUsageSource } from '../domain/metricsUiContract'
import { applyWsFrameToStore, componentToBucket } from './wsMetricsFrame'
import { useMetricsStore } from '../stores/metricsStore'

describe('parseResourceUsageSource', () => {
  it('accepts known backend source values', () => {
    expect(parseResourceUsageSource('metrics_api')).toBe('metrics_api')
    expect(parseResourceUsageSource('cadvisor')).toBe('cadvisor')
    expect(parseResourceUsageSource('requests')).toBe('requests')
    expect(parseResourceUsageSource('bad')).toBeUndefined()
  })
})

describe('componentToBucket resource sources', () => {
  it('maps cpuSource and memSource onto the bucket', () => {
    const bucket = componentToBucket({
      cpuSource: 'metrics_api',
      memSource: 'metrics_api',
      cpuLimit: 0.5,
      memoryLimit: 512 * 1024 * 1024,
      cpuUsage: 0.2,
      memoryBytes: 256 * 1024 * 1024,
    })
    expect(bucket.cpuSource).toBe('metrics_api')
    expect(bucket.memSource).toBe('metrics_api')
  })

  it('maps cache layers from WS component payload', () => {
    const bucket = componentToBucket({
      cacheMetricMode: 'layered',
      layers: [
        {
          id: 'redis-internal',
          role: 'backing-store',
          engine: 'redis',
          cpuUsage: 0.12,
          memoryUsage: 134217728,
          cpuLimit: 0.5,
          memoryLimit: 536870912,
          redisOpsPerSec: 21000,
          evictionsPerSec: 2.5,
          expirationsPerSec: 0.75,
          restartCount: 5,
        },
        {
          id: 'cache-proxy',
          role: 'sidecar',
          engine: 'caching-proxy',
          cpuUsage: 0.05,
          memoryUsage: 67108864,
          restartCount: 1,
        },
      ],
    })
    expect(bucket.layers).toHaveLength(2)
    expect(bucket.layers[0].id).toBe('redis-internal')
    expect(bucket.layers[1].id).toBe('cache-proxy')
    expect(bucket.layers[0].redisOpsPerSec).toBe(21000)
    expect(bucket.layers[0].evictionsPerSec).toBe(2.5)
    expect(bucket.layers[0].expirationsPerSec).toBe(0.75)
    // Proxy layer must not inherit backing-store lifecycle rates.
    expect(bucket.layers[1].evictionsPerSec).toBeUndefined()
    expect(bucket.layers[1].expirationsPerSec).toBeUndefined()
  })

  it('maps component-level cache store lifecycle rates onto the bucket', () => {
    const bucket = componentToBucket({
      component: 'cache',
      evictionsPerSec: 2.5,
      expirationsPerSec: 0.75,
    })
    expect(bucket.evictionsPerSec).toBe(2.5)
    expect(bucket.expirationsPerSec).toBe(0.75)

    const empty = componentToBucket({ component: 'cache' })
    expect(empty.evictionsPerSec).toBe(0)
    expect(empty.expirationsPerSec).toBe(0)
  })
})

describe('parseRecentLatenciesMs', () => {
  it('returns finite non-negative numbers in order', () => {
    expect(parseRecentLatenciesMs([12.5, '45.2', -1, NaN, 38])).toEqual([
      12.5, 45.2, 38,
    ])
  })

  it('returns empty array for non-array input', () => {
    expect(parseRecentLatenciesMs(null)).toEqual([])
  })
})

describe('applyWsFrameToStore loadgen latencies', () => {
  beforeEach(() => {
    useMetricsStore.setState({ loadgen: null })
  })

  it('stores recentLatenciesMs from WS loadgen payload', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 50,
          actualRps: 48,
          recentLatenciesMs: [10, 20, 30],
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().loadgen?.recentLatenciesMs).toEqual([
      10, 20, 30,
    ])
  })
})
