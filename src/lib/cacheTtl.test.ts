import { describe, expect, it } from 'vitest'
import {
  CACHE_TTL_MAX,
  CACHE_TTL_MIN,
  commitTimedCacheTtlDraft,
  defaultCacheTtlSecondsForTemplate,
  deployCacheTtlSeconds,
  isValidCacheTtlSeconds,
  isValidTimedCacheTtlSeconds,
  parseCacheTtlSeconds,
  seedCacheTtlSecondsDefault,
  showVolatileNoExpiryWarning,
} from './cacheTtl'

describe('cacheTtl', () => {
  it('maps template defaults', () => {
    expect(defaultCacheTtlSecondsForTemplate('url-shortener')).toBe(300)
    expect(defaultCacheTtlSecondsForTemplate('ecommerce')).toBe(60)
    expect(defaultCacheTtlSecondsForTemplate('social-feed')).toBe(0)
    expect(defaultCacheTtlSecondsForTemplate('unknown')).toBeUndefined()
  })

  it.each([0, 1, 300, 86400, '0', '1', '86400'])(
    'accepts valid cache TTL %s',
    (raw) => {
      expect(isValidCacheTtlSeconds(raw)).toBe(true)
      expect(parseCacheTtlSeconds(raw)).toBe(Number(raw))
    },
  )

  it.each([-1, 86401, 30.5, 'abc', '', null, undefined])(
    'rejects invalid cache TTL %s',
    (raw) => {
      expect(isValidCacheTtlSeconds(raw)).toBe(false)
      expect(parseCacheTtlSeconds(raw)).toBeNull()
    },
  )

  it('rejects 0 in timed mode but accepts bounds', () => {
    expect(isValidTimedCacheTtlSeconds(0)).toBe(false)
    expect(isValidTimedCacheTtlSeconds(CACHE_TTL_MIN)).toBe(true)
    expect(isValidTimedCacheTtlSeconds(CACHE_TTL_MAX)).toBe(true)
    expect(isValidTimedCacheTtlSeconds(86401)).toBe(false)
  })

  it('commits only valid changed timed drafts', () => {
    expect(commitTimedCacheTtlDraft('120', 300)).toEqual({
      ok: true,
      next: 120,
      changed: true,
    })
    expect(commitTimedCacheTtlDraft('300', 300)).toEqual({
      ok: true,
      next: 300,
      changed: false,
    })
    expect(commitTimedCacheTtlDraft('0', 300)).toEqual({ ok: false })
    expect(commitTimedCacheTtlDraft('86401', 300)).toEqual({ ok: false })
  })

  it('omits invalid values from the deploy wire', () => {
    expect(deployCacheTtlSeconds(0)).toBe(0)
    expect(deployCacheTtlSeconds(60)).toBe(60)
    expect(deployCacheTtlSeconds(undefined)).toBeUndefined()
    expect(deployCacheTtlSeconds(-1)).toBeUndefined()
    expect(deployCacheTtlSeconds(99999)).toBeUndefined()
  })

  it('seeds template defaults without overwriting', () => {
    expect(seedCacheTtlSecondsDefault({}, 'url-shortener')).toEqual({
      cacheTtlSeconds: 300,
    })
    expect(seedCacheTtlSecondsDefault({}, 'ecommerce')).toEqual({
      cacheTtlSeconds: 60,
    })
    expect(seedCacheTtlSecondsDefault({}, 'social-feed')).toEqual({
      cacheTtlSeconds: 0,
    })
    expect(
      seedCacheTtlSecondsDefault({ cacheTtlSeconds: 45 }, 'url-shortener'),
    ).toEqual({ cacheTtlSeconds: 45 })
    expect(
      seedCacheTtlSecondsDefault({ cacheTtlSeconds: 0 }, 'url-shortener'),
    ).toEqual({ cacheTtlSeconds: 0 })
    expect(seedCacheTtlSecondsDefault({}, 'unknown')).toEqual({})
  })

  it('shows amber volatile warning only for No expiry + volatile-*', () => {
    expect(showVolatileNoExpiryWarning('volatile-lru', 0)).toBe(true)
    expect(showVolatileNoExpiryWarning('volatile-ttl', 0)).toBe(true)
    expect(showVolatileNoExpiryWarning('volatile-lru', 300)).toBe(false)
    expect(showVolatileNoExpiryWarning('allkeys-lru', 0)).toBe(false)
    expect(showVolatileNoExpiryWarning('noeviction', 0)).toBe(false)
  })
})
