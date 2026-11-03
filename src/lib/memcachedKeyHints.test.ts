import { describe, expect, it } from 'vitest'
import {
  memcachedEmptyKeysMessage,
  memcachedExampleKeys,
  memcachedManualKeyPlaceholder,
} from './memcachedKeyHints'

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

describe('memcachedManualKeyPlaceholder', () => {
  it('does not use ecommerce keys on url-shortener', () => {
    expect(memcachedManualKeyPlaceholder('url-shortener', ['*'])).toBe('short-code')
    expect(memcachedManualKeyPlaceholder('url-shortener', ['*'])).not.toBe('catalog')
  })

  it('uses pattern literals when present', () => {
    expect(memcachedManualKeyPlaceholder('ecommerce', ['catalog'])).toBe('catalog')
  })
})
