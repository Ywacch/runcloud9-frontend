import { describe, expect, it } from 'vitest'
import {
  computeYDomain,
  formatChartTick,
  yAxisTicks,
} from './chartAxis'

describe('chartAxis', () => {
  it('computeYDomain pads flat series', () => {
    expect(computeYDomain([5, 5, 5])).toEqual({ min: 4.25, max: 5.75 })
  })

  it('computeYDomain floors at zero for positive data', () => {
    const d = computeYDomain([0, 10, 20])
    expect(d.min).toBe(0)
    expect(d.max).toBeGreaterThan(20)
  })

  it('formatChartTick uses K suffix', () => {
    expect(formatChartTick(14731)).toBe('15K')
    expect(formatChartTick(500, 'RPS')).toBe('500 RPS')
  })

  it('yAxisTicks returns top-to-bottom values', () => {
    expect(yAxisTicks(0, 100, 3)).toEqual([100, 50, 0])
  })
})
