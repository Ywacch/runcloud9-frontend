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
