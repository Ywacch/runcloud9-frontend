import { describe, expect, it } from 'vitest'
import { sumMemcachedStat } from './MemcachedStatsPanel'

describe('sumMemcachedStat', () => {
  it('sums a stat across servers', () => {
    const stats = {
      'cache:11211': { curr_items: '4', get_hits: '10' },
      'other:11211': { curr_items: '6', get_hits: '1' },
    }
    expect(sumMemcachedStat(stats, 'curr_items')).toBe(10)
    expect(sumMemcachedStat(stats, 'get_hits')).toBe(11)
  })

  it('returns null when the stat is absent', () => {
    expect(sumMemcachedStat({ a: { bytes: '1' } }, 'evictions')).toBeNull()
    expect(sumMemcachedStat(undefined, 'bytes')).toBeNull()
  })
})