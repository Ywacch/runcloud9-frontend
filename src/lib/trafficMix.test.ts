import { describe, expect, it } from 'vitest'
import {
  defaultEndpointPercents,
  distributionSnapshot,
  percentsToDistribution,
  redistributePercents,
  weightsToPercents,
} from './trafficMix'

describe('trafficMix', () => {
  it('weightsToPercents sums to 100', () => {
    expect(weightsToPercents([60, 30, 10])).toEqual([60, 30, 10])
    expect(weightsToPercents([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('redistributePercents keeps zeros at zero', () => {
    const next = redistributePercents([80, 20, 0], 0, 70)
    expect(next.reduce((a, b) => a + b, 0)).toBe(100)
    expect(next[0]).toBe(70)
    expect(next[1]).toBe(30)
    expect(next[2]).toBe(0)
  })

  it('redistributePercents assigns remainder when all others are zero', () => {
    const next = redistributePercents([100, 0, 0], 0, 80)
    expect(next).toEqual([80, 20, 0])
  })

  it('maps percents to backend distribution keys', () => {
    const endpoints = [
      { method: 'GET', pathTemplate: '/feed/{userId}', weight: 60 },
      { method: 'POST', pathTemplate: '/post', weight: 40 },
    ]
    expect(
      percentsToDistribution(endpoints, [40, 60]),
    ).toEqual({
      'GET /feed/{userId}': 40,
      'POST /post': 60,
    })
    expect(defaultEndpointPercents(endpoints)).toEqual([60, 40])
  })

  it('distributionSnapshot is stable', () => {
    expect(
      distributionSnapshot({
        'POST /post': 50,
        'GET /feed/{userId}': 50,
      }),
    ).toBe(
      distributionSnapshot({
        'GET /feed/{userId}': 50,
        'POST /post': 50,
      }),
    )
  })
})
