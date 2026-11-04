import { describe, expect, it } from 'vitest'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  dbTooltipLatencyMs,
  perReplicaLimit,
  rollup,
  samplesFromCompute,
  splitByRole,
  tooltipP99Label,
  type InstanceSample,
} from './instanceRollup'

describe('rollup', () => {
  it('means cpu and mem percents across homogeneous pods', () => {
    const samples: InstanceSample[] = [
      { id: 'a', cpuPct: 10, memPct: 20 },
      { id: 'b', cpuPct: 20, memPct: 40 },
      { id: 'c', cpuPct: 30, memPct: 60 },
    ]
    expect(rollup(samples)).toMatchObject({
      cpuPct: 20,
      memPct: 40,
    })
  })

  it('sums rps and takes max p99', () => {
    const samples: InstanceSample[] = [
      { id: 'a', cpuPct: 0, memPct: 0, rps: 1, p99: 0.1 },
      { id: 'b', cpuPct: 0, memPct: 0, rps: 2, p99: 0.4 },
      { id: 'c', cpuPct: 0, memPct: 0, rps: 3 },
    ]
    expect(rollup(samples)).toMatchObject({
      rps: 6,
      p99: 0.4,
    })
  })

  it('returns null p99 when no sample defines it', () => {
    const samples: InstanceSample[] = [{ id: 'a', cpuPct: 5, memPct: 5, rps: 1 }]
    expect(rollup(samples).p99).toBeNull()
    expect(tooltipP99Label(rollup(samples).p99)).toBe('-')
  })

  it('marks idle when summed rps is below the database floor', () => {
    const samples: InstanceSample[] = [
      { id: 'a', cpuPct: 0, memPct: 0, rps: 3 },
      { id: 'b', cpuPct: 0, memPct: 0, rps: 4 },
    ]
    expect(rollup(samples, { idleFloor: 8 }).idle).toBe(true)
    expect(rollup(samples, { idleFloor: 8 }).rps).toBe(7)
  })
})

describe('perReplicaLimit', () => {
  it('splits cluster sum limits across replica count', () => {
    expect(perReplicaLimit(3 * 1024 * 1024 * 1024, 3)).toBe(1024 * 1024 * 1024)
  })
})

describe('samplesFromCompute', () => {
  it('uses per-pod limits so cluster memory does not round to 0%', () => {
    const oneGi = 1024 * 1024 * 1024
    const podMem = 22 * 1024 * 1024
    const m = {
      cpuLimit: 0.375,
      memoryLimit: 3 * oneGi,
      podReplicas: [
        { name: 'a', ready: true, requestRate: 0, p99LatencyMs: 0, cpuUsage: 0.02, memoryBytes: podMem },
        { name: 'b', ready: true, requestRate: 0, p99LatencyMs: 0, cpuUsage: 0.02, memoryBytes: podMem },
        { name: 'c', ready: true, requestRate: 0, p99LatencyMs: 0, cpuUsage: 0.02, memoryBytes: podMem },
      ],
    } as MetricsBucket

    const samples = samplesFromCompute(m)
    expect(samples.every((s) => s.memPct != null && s.memPct > 0)).toBe(true)
    expect(rollup(samples).memPct).toBeGreaterThan(0)
  })

  it('returns null cpuPct when pod cpu limit is missing', () => {
    const m = {
      cpuLimit: 0,
      memoryLimit: 0,
      podReplicas: [
        {
          name: 'a',
          ready: true,
          requestRate: 0,
          p99LatencyMs: 0,
          cpuUsage: 0.09,
          memoryBytes: 0,
        },
      ],
    } as MetricsBucket

    const samples = samplesFromCompute(m)
    expect(samples[0]?.cpuPct).toBeNull()
    expect(samples[0]?.memPct).toBeNull()
  })
})

describe('splitByRole', () => {
  it('does not blend primary and replica cpu', () => {
    const samples: InstanceSample[] = [
      { id: 'postgres', role: 'primary', cpuPct: 80, memPct: 50 },
      { id: 'rep-1', role: 'replica', cpuPct: 10, memPct: 12 },
    ]
    const byRole = splitByRole(samples)
    expect(rollup(byRole.get('primary') ?? []).cpuPct).toBe(80)
    expect(rollup(byRole.get('replica') ?? []).cpuPct).toBe(10)
    expect(rollup(samples).cpuPct).toBe(45)
  })
})

describe('dbTooltipLatencyMs', () => {
  it('falls back to dbQueryLatency when p99Latency is unset', () => {
    const m = {
      p99Latency: 0,
      dbQueryLatency: 0.005,
      avgLatency: 0,
    } as MetricsBucket
    expect(dbTooltipLatencyMs(m)).toBe(5)
  })

  it('prefers layer p99 when scoped to a db instance', () => {
    const m = {
      p99Latency: 0,
      dbQueryLatency: 0.005,
    } as MetricsBucket
    const layer = {
      id: 'postgres',
      role: 'primary',
      engine: 'postgresql',
      cpuUsage: 0.03,
      cpuLimit: 0.25,
      memoryBytes: 80 * 1024 * 1024,
      memoryLimit: 256 * 1024 * 1024,
      cpuIsEstimated: false,
      memIsEstimated: false,
      p99LatencyMs: 12,
    } satisfies ComponentLayerMetrics
    expect(dbTooltipLatencyMs(m, layer)).toBe(12)
  })
})
