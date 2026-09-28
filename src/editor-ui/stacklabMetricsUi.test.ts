import { describe, expect, it } from 'vitest'
import { counterBandPercents } from './stacklabMetricsUi'

describe('counterBandPercents', () => {
  it('normalizes raw rates to mock-style bar heights', () => {
    expect(counterBandPercents([0, 50, 100])).toEqual([0, 50, 100])
  })

  it('uses 15% idle strip when all samples are zero', () => {
    expect(counterBandPercents([0, 0])).toEqual([15, 15])
  })
})
