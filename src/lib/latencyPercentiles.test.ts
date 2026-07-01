import { describe, expect, it } from 'vitest'
import {
  boxPlotQuartiles,
  latencyReferenceLines,
  percentileSorted,
} from './latencyPercentiles'

describe('percentileSorted', () => {
  it('interpolates p50 on an even-length sample', () => {
    expect(percentileSorted([10, 20, 30, 40], 50)).toBe(25)
  })

  it('returns the sole value for a single sample', () => {
    expect(percentileSorted([42], 99)).toBe(42)
  })
})

describe('latencyReferenceLines', () => {
  it('computes mean and percentiles from recent samples', () => {
    const refs = latencyReferenceLines([10, 20, 30, 40, 100])
    expect(refs.mean).toBeCloseTo(40)
    expect(refs.p50).toBe(30)
    expect(refs.p95).toBeGreaterThan(40)
    expect(refs.p99).toBeGreaterThanOrEqual(refs.p95)
  })
})

describe('boxPlotQuartiles', () => {
  it('returns null for fewer than four samples', () => {
    expect(boxPlotQuartiles([10, 20, 30])).toBeNull()
  })

  it('computes quartiles and whiskers on a known dataset', () => {
    const samples = [10, 20, 30, 40, 50, 60, 70, 80]
    const box = boxPlotQuartiles(samples)
    expect(box).not.toBeNull()
    expect(box!.whiskerMin).toBe(10)
    expect(box!.whiskerMax).toBe(80)
    expect(box!.median).toBeCloseTo(percentileSorted(samples, 50))
    expect(box!.q1).toBeCloseTo(percentileSorted(samples, 25))
    expect(box!.q3).toBeCloseTo(percentileSorted(samples, 75))
  })
})
