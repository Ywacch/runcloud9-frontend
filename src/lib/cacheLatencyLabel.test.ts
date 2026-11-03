import { describe, expect, it } from 'vitest'
import { formatCacheLatencyMs } from './cacheLatencyLabel'

describe('formatCacheLatencyMs', () => {
  it('keeps one decimal under 10 ms', () => {
    expect(formatCacheLatencyMs(0.4)).toBe('0.4')
    expect(formatCacheLatencyMs(4)).toBe('4.0')
  })

  it('rounds from 10 ms', () => {
    expect(formatCacheLatencyMs(12.2)).toBe('12')
  })

  it('returns null when the sample is missing', () => {
    expect(formatCacheLatencyMs(0)).toBeNull()
    expect(formatCacheLatencyMs(Number.NaN)).toBeNull()
  })
})
