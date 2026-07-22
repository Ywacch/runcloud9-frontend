import { describe, expect, it } from 'vitest'
import {
  REDIS_EVICTION_POLICIES,
  REDIS_EVICTION_POLICY_DESCRIPTION,
  REDIS_EVICTION_POLICY_LABEL,
  isVolatileRedisEvictionPolicy,
  normalizeRedisEvictionPolicy,
} from './redisEvictionPolicy'

describe('redisEvictionPolicy', () => {
  it.each(REDIS_EVICTION_POLICIES)('normalizes %s unchanged', (policy) => {
    expect(normalizeRedisEvictionPolicy(policy)).toBe(policy)
  })

  it('normalizes whitespace and case to canonical lowercase', () => {
    expect(normalizeRedisEvictionPolicy('  ALLKEYS-LFU  ')).toBe('allkeys-lfu')
    expect(normalizeRedisEvictionPolicy(' Volatile-TTL ')).toBe('volatile-ttl')
  })

  it.each([undefined, null, '', 'invalid-policy', 42])(
    'falls back to allkeys-lru for %s',
    (value) => {
      expect(normalizeRedisEvictionPolicy(value)).toBe('allkeys-lru')
    },
  )

  it.each(REDIS_EVICTION_POLICIES)('provides a label and description for %s', (policy) => {
    expect(REDIS_EVICTION_POLICY_LABEL[policy].trim()).not.toBe('')
    expect(REDIS_EVICTION_POLICY_DESCRIPTION[policy].trim()).not.toBe('')
    expect(REDIS_EVICTION_POLICY_LABEL[policy]).toContain(': ')
    expect(REDIS_EVICTION_POLICY_LABEL[policy]).not.toContain('—')
  })

  it.each(['allkeys-lru', 'allkeys-lfu', 'allkeys-random'] as const)(
    'explains that %s may remove any key',
    (policy) => {
      expect(REDIS_EVICTION_POLICY_DESCRIPTION[policy]).toMatch(/^Any key can be removed\./)
      expect(isVolatileRedisEvictionPolicy(policy)).toBe(false)
    },
  )

  it.each(['volatile-lru', 'volatile-lfu', 'volatile-random', 'volatile-ttl'] as const)(
    'explains that %s may remove only keys with a TTL',
    (policy) => {
      expect(REDIS_EVICTION_POLICY_DESCRIPTION[policy]).toMatch(
        /^Only keys with a TTL can be removed\./,
      )
      expect(isVolatileRedisEvictionPolicy(policy)).toBe(true)
    },
  )

  it('does not classify noeviction as volatile', () => {
    expect(isVolatileRedisEvictionPolicy('noeviction')).toBe(false)
  })
})
