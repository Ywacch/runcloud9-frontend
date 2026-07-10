import { describe, expect, it, beforeEach } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { TIER_C_WARMUP_MS } from '../editor-ui/inspectorPanelUi'
import {
  __tierCWarmupSessionTestState,
  clearTierCWarmupSession,
  isDbTierCWarmingUp,
  recordTierCSample,
  syncDbTierCWarmup,
} from './tierCWarmupSession'

function tierCBucket(partial: Partial<MetricsBucket> = {}): MetricsBucket {
  return {
    cpuUsage: 0.125,
    cpuPercent: 100,
    memoryBytes: 207_618_048,
    memPercent: 77,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0.125,
    memoryLimit: 268_435_456,
    cpuSource: 'metrics_api',
    memSource: 'metrics_api',
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
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

beforeEach(() => {
  clearTierCWarmupSession()
})

describe('tierCWarmupSession', () => {
  it('warms up from first Tier C sample and completes after the window', () => {
    const nodeId = 'db-1'
    const start = 1_000_000
    recordTierCSample(nodeId, tierCBucket(), start)

    expect(isDbTierCWarmingUp(nodeId, tierCBucket(), start + 30_000)).toBe(true)
    expect(isDbTierCWarmingUp(nodeId, tierCBucket(), start + TIER_C_WARMUP_MS)).toBe(false)
    expect(isDbTierCWarmingUp(nodeId, tierCBucket(), start + TIER_C_WARMUP_MS + 1)).toBe(
      false,
    )
  })

  it('does not restart warmup after inspector remount simulation', () => {
    const nodeId = 'db-1'
    const start = 1_000_000
    recordTierCSample(nodeId, tierCBucket(), start)

    expect(syncDbTierCWarmup(nodeId, tierCBucket(), start + 90_000)).toBe(false)
    expect(syncDbTierCWarmup(nodeId, tierCBucket(), start + 120_000)).toBe(false)
  })

  it('ignores estimated samples until real Tier C arrives', () => {
    const nodeId = 'db-1'
    const start = 1_000_000
    recordTierCSample(nodeId, tierCBucket({ cpuIsEstimated: true }), start)
    expect(isDbTierCWarmingUp(nodeId, tierCBucket({ cpuIsEstimated: true }), start)).toBe(
      false,
    )

    recordTierCSample(nodeId, tierCBucket(), start + 300_000)
    expect(isDbTierCWarmingUp(nodeId, tierCBucket(), start + 300_000)).toBe(true)
    expect(isDbTierCWarmingUp(nodeId, tierCBucket(), start + 300_000 + TIER_C_WARMUP_MS)).toBe(
      false,
    )
  })

  it('clears per-node state on session reset', () => {
    const nodeId = 'db-1'
    recordTierCSample(nodeId, tierCBucket(), 1_000_000)
    expect(__tierCWarmupSessionTestState().firstTierCAtByNode.size).toBe(1)

    clearTierCWarmupSession()
    expect(__tierCWarmupSessionTestState().firstTierCAtByNode.size).toBe(0)
    expect(isDbTierCWarmingUp(nodeId, tierCBucket(), 1_030_000)).toBe(false)
  })
})
