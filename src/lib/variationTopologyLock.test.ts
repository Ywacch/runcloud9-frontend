import { describe, expect, it } from 'vitest'
import {
  filterStrategiesForVariation,
  isVariationTopologyLocked,
  variationCacheStrategyMode,
} from './variationTopologyLock'

describe('variationTopologyLock', () => {
  it('locks topology when a variation id is set', () => {
    expect(isVariationTopologyLocked(null)).toBe(false)
    expect(isVariationTopologyLocked('app-db-cache')).toBe(true)
  })

  it('freezes non-proxy variation cache strategies', () => {
    expect(variationCacheStrategyMode('app-db-cache')).toBe('frozen')
    expect(variationCacheStrategyMode('timeline-async')).toBe('frozen')
  })

  it('allows proxy variation write-through and write-behind only', () => {
    expect(variationCacheStrategyMode('app-db-cache-proxy')).toBe('proxy-toggle')
    expect(
      filterStrategiesForVariation(
        ['cache-aside', 'write-through', 'write-behind'],
        'app-db-cache-proxy',
      ),
    ).toEqual(['write-through', 'write-behind'])
  })
})
