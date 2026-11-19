import { describe, expect, it } from 'vitest'
import { buildCacheStrategyPatch } from './cacheStrategyDesignPatch'

describe('buildCacheStrategyPatch', () => {
  it('clears proxy profile when leaving proxy strategy', () => {
    const patch = buildCacheStrategyPatch(
      {
        cacheStrategy: 'write-through',
        proxyInstanceSize: 'medium',
        proxyResourceProfile: 'medium',
      },
      'cache-aside',
      'ecommerce',
    )
    expect(patch.cacheStrategy).toBe('cache-aside')
    expect(patch.proxyInstanceSize).toBeUndefined()
    expect(patch.proxyResourceProfile).toBeUndefined()
  })

  it('seeds proxy size when entering proxy strategy', () => {
    const patch = buildCacheStrategyPatch(
      { instanceSize: 'small', cacheStrategy: 'cache-aside' },
      'write-through',
      'ecommerce',
    )
    expect(patch.proxyInstanceSize).toBeTruthy()
    expect(patch.proxyResourceProfile).toBeTruthy()
  })
})