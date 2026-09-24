import { describe, expect, it } from 'vitest'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { canvasHealthState, resolveCacheCanvasFocus } from './cacheCanvasFocus'

function layer(
  partial: Partial<ComponentLayerMetrics> & Pick<ComponentLayerMetrics, 'id' | 'role'>,
): ComponentLayerMetrics {
  return {
    engine: partial.id,
    cpuUsage: 0.05,
    memoryBytes: 32 * 1024 * 1024,
    cpuLimit: 1,
    memoryLimit: 256 * 1024 * 1024,
    cpuIsEstimated: false,
    memIsEstimated: false,
    ...partial,
  }
}

function bucket(partial: Partial<MetricsBucket>): MetricsBucket {
  return {
    cpuPercent: 10,
    memPercent: 10,
    cpuIsEstimated: false,
    memIsEstimated: false,
    errorRate: 0,
    layers: [],
    runtimeHealth: null,
    redisMaxClients: 0,
    p99Latency: 1.4,
    requestRate: 200,
    ...partial,
  } as MetricsBucket
}

const redis = layer({ id: 'redis-internal', role: 'backing-store' })
const proxy = layer({
  id: 'cache-proxy',
  role: 'sidecar',
  cpuUsage: 0.1,
  cpuLimit: 0.25,
  memoryBytes: 40 * 1024 * 1024,
  memoryLimit: 128 * 1024 * 1024,
})

describe('resolveCacheCanvasFocus', () => {
  it('returns null for a single-process cache', () => {
    expect(resolveCacheCanvasFocus(bucket({}))).toBeNull()
  })

  it('defaults a healthy proxy cache to the proxy surface', () => {
    const focus = resolveCacheCanvasFocus(bucket({ layers: [redis, proxy] }))
    expect(focus?.layer).toBe('proxy')
    expect(focus?.metricGroup).toBeNull()
    expect(focus?.severity).toBe('healthy')
  })

  it('follows the hotter layer and ignores the blended bucket', () => {
    const hotRedis = layer({
      id: 'redis-internal',
      role: 'backing-store',
      cpuUsage: 0.9,
      cpuLimit: 1,
    })
    const focus = resolveCacheCanvasFocus(
      bucket({ cpuPercent: 30, memPercent: 20, layers: [hotRedis, proxy] }),
    )
    expect(focus?.layer).toBe('redis')
    expect(focus?.metricGroup).toBe('engine')
    expect(focus?.severity).toBe('warning')
    expect(canvasHealthState(bucket({ cpuPercent: 30, layers: [hotRedis, proxy] }), 'healthy')).toBe(
      'warning',
    )
  })

  it('prefers red over a yellow sibling', () => {
    const hotProxy = layer({
      id: 'cache-proxy',
      role: 'sidecar',
      cpuUsage: 0.95,
      cpuLimit: 1,
    })
    const focus = resolveCacheCanvasFocus(
      bucket({
        layers: [redis, hotProxy],
        runtimeHealth: {
          unreadyCount: 1,
          restarting: false,
          pods: [{ name: 'redis-internal-0', ready: false, restartCount: 1 }],
        },
      }),
    )
    expect(focus?.layer).toBe('redis')
    expect(focus?.metricGroup).toBe('engine')
    expect(focus?.severity).toBe('error')
    expect(canvasHealthState(bucket({ layers: [redis, hotProxy], runtimeHealth: {
      unreadyCount: 1,
      restarting: false,
      pods: [{ name: 'redis-internal-0', ready: false, restartCount: 1 }],
    } }), 'healthy')).toBe('error')
  })

  it('warns on redis client saturation even when cpu is quiet', () => {
    const focus = resolveCacheCanvasFocus(
      bucket({
        layers: [redis, proxy],
        redisConnectedClients: 90,
        redisMaxClients: 100,
      }),
    )
    expect(focus?.layer).toBe('redis')
    expect(focus?.metricGroup).toBe('engine')
    expect(focus?.severity).toBe('warning')
  })
})
