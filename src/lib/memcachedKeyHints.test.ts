import { describe, expect, it } from 'vitest'
import { memcachedEmptyKeysMessage, memcachedExampleKeys } from './memcachedKeyHints'

describe('memcachedExampleKeys', () => {
  it('turns globs into one sample key and keeps literals', () => {
    expect(
      memcachedExampleKeys(['product:*', 'cart:*', 'catalog', 'product-pool']),
    ).toEqual(['product:1', 'cart:1', 'catalog', 'product-pool'])
  })
})

describe('memcachedEmptyKeysMessage', () => {
  it('names ecommerce warm paths', () => {
    expect(memcachedEmptyKeysMessage('ecommerce', ['catalog'])).toContain('/catalog')
  })
})
