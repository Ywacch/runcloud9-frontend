import { describe, expect, it } from 'vitest'
import {
  formatLogElapsedClock,
  logElapsedSeconds,
  logOriginMs,
  logSourceLabel,
} from './logPanelView'

describe('logSourceLabel', () => {
  it('uses prototype source names', () => {
    expect(logSourceLabel('db')).toBe('postgres')
    expect(logSourceLabel('postgres')).toBe('postgres')
    expect(logSourceLabel('cache')).toBe('redis')
    expect(logSourceLabel('mq')).toBe('message-queue')
  })
})

describe('formatLogElapsedClock', () => {
  it('matches +m:ss', () => {
    expect(formatLogElapsedClock(0)).toBe('+0:00')
    expect(formatLogElapsedClock(11)).toBe('+0:11')
    expect(formatLogElapsedClock(75)).toBe('+1:15')
  })
})

describe('logElapsedSeconds', () => {
  it('is relative to the first line', () => {
    const origin = Date.parse('2026-01-01T00:00:00.000Z')
    expect(
      logElapsedSeconds('2026-01-01T00:00:11.000Z', origin),
    ).toBe(11)
    expect(logOriginMs(['2026-01-01T00:00:11.000Z', '2026-01-01T00:00:00.000Z'])).toBe(
      origin,
    )
  })
})
