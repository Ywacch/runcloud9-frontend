import { describe, expect, it } from 'vitest'
import { latencyReferenceLines, percentileSorted } from './latencyPercentiles'

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
