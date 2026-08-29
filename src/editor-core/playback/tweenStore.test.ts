import { describe, expect, it, beforeEach } from 'vitest'
import type { MetricsBucket } from '../stores/metricsStore'
import {
  TWEEN_DAMPING,
  MAX_DELTA_MS,
  applyTweenDampingStep,
  dampingStepsForDelta,
  getTweenedMetricValue,
  isTweenFieldAbsent,
  readTweenTarget,
  resetTweenStore,
  runTweenSteps,
} from './tweenStore'

function bucket(partial: Partial<MetricsBucket>): MetricsBucket {
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
    storageEngine: '',
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
    podCount: 0,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

describe('tweenStore', () => {
  beforeEach(() => {
    resetTweenStore()
  })

  it('converges toward target within ~30 damping steps', () => {
    const metrics = {
      app: bucket({ requestRate: 100 }),
    }
    for (let i = 0; i < 30; i++) {
      applyTweenDampingStep(metrics, TWEEN_DAMPING)
    }
    const v = getTweenedMetricValue('app', 'requestRate')
    expect(v).not.toBeNull()
    expect(v!).toBeGreaterThan(95)
    expect(v!).toBeLessThanOrEqual(100)
  })

  it('caps sub-steps for large delta (tab sleep)', () => {
    expect(dampingStepsForDelta(5000)).toBeLessThanOrEqual(
      Math.ceil(MAX_DELTA_MS / (1000 / 60)),
    )
    expect(dampingStepsForDelta(16)).toBe(1)
  })

  it('does not tween dbQueryRate when dbQuerySource is none', () => {
    const b = bucket({ dbQueryRate: 42, dbQuerySource: 'none' })
    expect(isTweenFieldAbsent(b, 'dbQueryRate')).toBe(true)
    expect(readTweenTarget(b, 'dbQueryRate')).toBeNull()
    applyTweenDampingStep({ db: b })
    expect(getTweenedMetricValue('db', 'dbQueryRate')).toBeNull()
  })

  it('tweens zero down when loadgen stops', () => {
    let metrics = { app: bucket({ requestRate: 50 }) }
    for (let i = 0; i < 20; i++) applyTweenDampingStep(metrics, TWEEN_DAMPING)
    metrics = { app: bucket({ requestRate: 0 }) }
    runTweenSteps(metrics, 16, TWEEN_DAMPING)
    const v = getTweenedMetricValue('app', 'requestRate')
    expect(v).not.toBeNull()
    expect(v!).toBeLessThan(50)
    expect(v!).toBeGreaterThan(0)
  })
})
