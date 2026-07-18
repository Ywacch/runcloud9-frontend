import { describe, expect, it } from 'vitest'
import {
  WRITE_BEHIND_INTERVAL_DEFAULT,
  isValidWriteBehindInterval,
  normalizeWriteBehindIntervalSeconds,
  parseWriteBehindIntervalInput,
  commitWriteBehindIntervalDraft,
  seedWriteBehindIntervalDefault,
  showsWriteBehindIntervalControl,
  templateSupportsWriteBehindInterval,
} from './writeBehindInterval'

describe('writeBehindInterval', () => {
  it('supports only url-shortener for the flush-interval control', () => {
    expect(templateSupportsWriteBehindInterval('url-shortener')).toBe(true)
    expect(templateSupportsWriteBehindInterval('ecommerce')).toBe(false)
    expect(templateSupportsWriteBehindInterval('social-feed')).toBe(false)
    expect(templateSupportsWriteBehindInterval(undefined)).toBe(false)
  })

  it('shows the control only for url-shortener write-behind', () => {
    expect(showsWriteBehindIntervalControl('url-shortener', 'write-behind')).toBe(
      true,
    )
    expect(showsWriteBehindIntervalControl('url-shortener', 'write-through')).toBe(
      false,
    )
    expect(showsWriteBehindIntervalControl('url-shortener', 'cache-aside')).toBe(
      false,
    )
    expect(showsWriteBehindIntervalControl('ecommerce', 'write-behind')).toBe(false)
    expect(showsWriteBehindIntervalControl('social-feed', 'write-behind')).toBe(
      false,
    )
  })

  it.each([1, 30, 300, '1', '30', '300'])('accepts valid input %s', (raw) => {
    expect(isValidWriteBehindInterval(raw)).toBe(true)
    expect(parseWriteBehindIntervalInput(raw)).toBe(Number(raw))
  })

  it.each([0, -1, 301, 30.5, '0', '-1', '301', '30.5', 'abc', '', ' ', null, undefined])(
    'rejects invalid input %s',
    (raw) => {
      expect(isValidWriteBehindInterval(raw)).toBe(false)
      expect(parseWriteBehindIntervalInput(raw)).toBeNull()
    },
  )

  it('normalizes missing/invalid to 30 and clamps above 300', () => {
    expect(normalizeWriteBehindIntervalSeconds(undefined)).toBe(
      WRITE_BEHIND_INTERVAL_DEFAULT,
    )
    expect(normalizeWriteBehindIntervalSeconds(0)).toBe(30)
    expect(normalizeWriteBehindIntervalSeconds(-5)).toBe(30)
    expect(normalizeWriteBehindIntervalSeconds('nope')).toBe(30)
    expect(normalizeWriteBehindIntervalSeconds(301)).toBe(300)
    expect(normalizeWriteBehindIntervalSeconds('450')).toBe(300)
    expect(normalizeWriteBehindIntervalSeconds(12.9)).toBe(12)
    expect(normalizeWriteBehindIntervalSeconds(1)).toBe(1)
    expect(normalizeWriteBehindIntervalSeconds(300)).toBe(300)
  })

  it('seeds default 30 on url-shortener cache configs when missing', () => {
    expect(seedWriteBehindIntervalDefault({}, 'url-shortener')).toEqual({
      writeBehindIntervalSeconds: 30,
    })
    expect(
      seedWriteBehindIntervalDefault(
        { writeBehindIntervalSeconds: 45 },
        'url-shortener',
      ),
    ).toEqual({ writeBehindIntervalSeconds: 45 })
    expect(seedWriteBehindIntervalDefault({}, 'ecommerce')).toEqual({})
  })

  it('commits only valid changed drafts', () => {
    expect(commitWriteBehindIntervalDraft('45', 30)).toEqual({
      ok: true,
      next: 45,
      changed: true,
    })
    expect(commitWriteBehindIntervalDraft('30', 30)).toEqual({
      ok: true,
      next: 30,
      changed: false,
    })
    expect(commitWriteBehindIntervalDraft('0', 30)).toEqual({ ok: false })
    expect(commitWriteBehindIntervalDraft('301', 30)).toEqual({ ok: false })
    expect(commitWriteBehindIntervalDraft('12.5', 30)).toEqual({ ok: false })
  })
})
