import { describe, expect, it } from 'vitest'
import { cacheLogEmptyMessage } from './cacheLogEmpty'

describe('cacheLogEmptyMessage', () => {
  it('names the memcached log level', () => {
    expect(cacheLogEmptyMessage('memcached')).toBe(
      'Memcached logs errors and warnings only.',
    )
  })

  it('keeps the generic line for other engines', () => {
    expect(cacheLogEmptyMessage('redis')).toBe(
      'NO EVENTS AT THIS LEVEL IN THE CURRENT WINDOW',
    )
    expect(cacheLogEmptyMessage(undefined)).toBe(
      'NO EVENTS AT THIS LEVEL IN THE CURRENT WINDOW',
    )
  })
})