import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMetricsStore, type LiveLoadgenState, type MetricsBucket } from './metricsStore'

function bucket(requestRate: number): MetricsBucket {
  return {
    cpuUsage: 0,
    cpuPercent: 0,
    memoryBytes: 0,
    memPercent: 0,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 1,
    memoryLimit: 1024,
    requestRate,
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
    podCount: 1,
    lastUpdated: Date.now(),
    qps: 0,
  }
}

const loadgenPayload: LiveLoadgenState = {
  active: true,
  targetRps: 50,
  currentRps: 50,
  actualRps: 48,
  intervalActualRps: 48,
  intervalP99Ms: 120,
  recentIntervals: [],
  recentLatenciesMs: [10, 20],
  totalRequests: 100,
  successRate: 0.99,
  durationSeconds: 60,
  elapsedSeconds: 12,
  statusCodes: { '200': 99 },
  scheduleId: 'steady',
  currentPhase: 'baseline',
  phaseIndex: 0,
  distribution: { 'GET /': 100 },
}

describe('metricsStore applyMetricsBuckets', () => {
  beforeEach(() => {
    useMetricsStore.setState({ metrics: {}, history: {} })
  })

  it('merges many buckets in one set without appending history', () => {
    const spy = vi.fn()
    const unsub = useMetricsStore.subscribe(spy)
    useMetricsStore.getState().applyMetricsBuckets(
      {
        a: bucket(10),
        b: bucket(20),
      },
      { appendHistory: false },
    )
    unsub()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(useMetricsStore.getState().metrics.a?.requestRate).toBe(10)
    expect(useMetricsStore.getState().metrics.b?.requestRate).toBe(20)
    expect(useMetricsStore.getState().history).toEqual({})
  })

  it('appends capped history when appendHistory is true', () => {
    const first = bucket(1)
    useMetricsStore.getState().applyMetricsBuckets({ n: first }, { appendHistory: true })
    for (let i = 2; i <= 31; i += 1) {
      useMetricsStore.getState().applyMetricsBuckets({ n: bucket(i) }, { appendHistory: true })
    }
    const history = useMetricsStore.getState().history.n ?? []
    expect(history).toHaveLength(30)
    expect(history[0]?.requestRate).toBe(2)
    expect(history[29]?.requestRate).toBe(31)
  })
})

describe('metricsStore setLoadgen', () => {
  beforeEach(() => {
    useMetricsStore.setState({ loadgen: loadgenPayload })
  })

  it('keeps loadgen reference when payload is shallow-equal', () => {
    const before = useMetricsStore.getState().loadgen
    useMetricsStore.getState().setLoadgen({ ...loadgenPayload })
    expect(useMetricsStore.getState().loadgen).toBe(before)
  })

  it('updates loadgen when a watched field changes', () => {
    useMetricsStore.getState().setLoadgen({ ...loadgenPayload, actualRps: 40 })
    expect(useMetricsStore.getState().loadgen?.actualRps).toBe(40)
  })
})
