import { describe, expect, it } from 'vitest'
import {
  rollup,
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
    expect(tooltipP99Label(rollup(samples).p99)).toBe('—')
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
