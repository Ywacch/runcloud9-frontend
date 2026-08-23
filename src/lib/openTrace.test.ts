import { describe, expect, it } from 'vitest'
import { isCacheDbStaleEvent } from './openTrace'

describe('isCacheDbStaleEvent', () => {
  it('detects cache_db_stale detail kind', () => {
    expect(isCacheDbStaleEvent({ kind: 'cache_db_stale' })).toBe(true)
    expect(isCacheDbStaleEvent({ kind: 'ryw' })).toBe(false)
    expect(isCacheDbStaleEvent(undefined)).toBe(false)
  })
})
