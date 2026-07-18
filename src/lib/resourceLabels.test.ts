import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  formatResourceLabels,
  memoryUsageHelp,
  resourceFreshnessSuffix,
  resourceUsageHelp,
} from '../editor-ui/inspectorPanelUi'

function bucket(partial: Partial<MetricsBucket>): MetricsBucket {
  return {
    cpuUsage: 0.125,
    cpuPercent: 42,
    memoryBytes: 207_618_048,
    memPercent: 77,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0.25,
    memoryLimit: 268_435_456,
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
    layers: [],
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

describe('resourceFreshnessSuffix', () => {
  it('does not append inline freshness text (shown on help hover instead)', () => {
    expect(resourceFreshnessSuffix('metrics_api')).toBe('')
    expect(resourceFreshnessSuffix('cadvisor')).toBe('')
  })
})

describe('formatResourceLabels', () => {
  it('shows static limits when estimated', () => {
    const labels = formatResourceLabels(
      bucket({ cpuIsEstimated: true, memIsEstimated: true }),
      0,
      0,
    )
    expect(labels.cpu).toBe('Limit 250m')
    expect(labels.mem).toBe('Limit 256 MB')
  })

  it('shows utilization without inline freshness suffix', () => {
    const labels = formatResourceLabels(
      bucket({ cpuSource: 'metrics_api', memSource: 'metrics_api' }),
      42,
      77,
    )
    expect(labels.cpu).toBe('42%')
    expect(labels.mem).toContain('77%')
    expect(labels.mem).not.toContain('~15–60s')
  })

  it('shows cadvisor utilization without freshness suffix', () => {
    const labels = formatResourceLabels(
      bucket({ cpuSource: 'cadvisor', memSource: 'cadvisor' }),
      42,
      77,
    )
    expect(labels.cpu).toBe('42%')
    expect(labels.mem).toContain('77%')
    expect(labels.mem).not.toContain('~15–60s')
  })
})

describe('memoryUsageHelp', () => {
  it('returns utilization percent only', () => {
    expect(memoryUsageHelp(bucket({ memSource: 'metrics_api' }), 77)).toBe('77%')
  })

  it('returns alloc help when estimated', () => {
    expect(memoryUsageHelp(bucket({ memIsEstimated: true }), 0)).toMatch(
      /Allocated, not measured/,
    )
  })

  it('returns metrics_api hint from freshness map', () => {
    expect(
      memoryUsageHelp(
        bucket({
          freshness: {
            containerMem: {
              tier: 'metrics_api',
              nominalLagSeconds: 45,
              source: 'metrics_api',
            },
          },
        }),
        77,
      ),
    ).toMatch(/Delayed ~15–60s/)
  })
})

describe('resourceUsageHelp', () => {
  it('returns alloc help when estimated', () => {
    expect(resourceUsageHelp(bucket({ cpuIsEstimated: true }))).toMatch(
      /Allocated, not measured/,
    )
  })

  it('returns metrics API freshness when source is metrics_api', () => {
    expect(
      resourceUsageHelp(bucket({ cpuSource: 'metrics_api' })),
    ).toMatch(/Delayed ~15–60s/)
  })

  it('prefers freshness map over legacy cpuSource', () => {
    expect(
      resourceUsageHelp(
        bucket({
          cpuSource: 'cadvisor',
          freshness: {
            containerCpu: {
              tier: 'metrics_api',
              nominalLagSeconds: 45,
              source: 'metrics_api',
            },
          },
        }),
      ),
    ).toMatch(/Delayed ~15–60s/)
  })
})
