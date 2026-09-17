import { describe, expect, it } from 'vitest'
import {
  WS_DATA_DEGRADED_MS,
  WS_TRANSPORT_DEAD_MS,
} from '../playback/playbackConfig'
import {
  WEBSOCKET_OPEN,
  isMetricsDataDegraded,
  isWsConnectionStale,
  wsReconnectDelayMs,
} from './wsStaleWatchdog'

describe('isWsConnectionStale', () => {
  const now = 100_000

  it('returns false shortly after connect before the first frame', () => {
    expect(
      isWsConnectionStale(WEBSOCKET_OPEN, 0, now, {
        connectedAt: now - 1_000,
      }),
    ).toBe(false)
  })

  it('returns true when OPEN with no first frame past the threshold', () => {
    expect(
      isWsConnectionStale(WEBSOCKET_OPEN, 0, now, {
        connectedAt: now - WS_TRANSPORT_DEAD_MS - 1,
      }),
    ).toBe(true)
  })

  it('returns false while within the stale threshold after a frame', () => {
    expect(
      isWsConnectionStale(
        WEBSOCKET_OPEN,
        now - WS_TRANSPORT_DEAD_MS,
        now,
      ),
    ).toBe(false)
  })

  it('returns true when OPEN and idle past the threshold after a frame', () => {
    expect(
      isWsConnectionStale(
        WEBSOCKET_OPEN,
        now - WS_TRANSPORT_DEAD_MS - 1,
        now,
      ),
    ).toBe(true)
  })

  it('returns false when the socket is not open', () => {
    expect(
      isWsConnectionStale(0, now - WS_TRANSPORT_DEAD_MS - 1, now),
    ).toBe(false)
  })
})

describe('isMetricsDataDegraded', () => {
  it('returns false while collect is pending', () => {
    expect(isMetricsDataDegraded(WS_DATA_DEGRADED_MS + 1, true)).toBe(false)
  })

  it('returns false when snapshot age is within the degraded window', () => {
    expect(isMetricsDataDegraded(WS_DATA_DEGRADED_MS, false)).toBe(false)
    expect(isMetricsDataDegraded(1000, false)).toBe(false)
  })

  it('returns true when snapshot age exceeds the degraded window', () => {
    expect(isMetricsDataDegraded(WS_DATA_DEGRADED_MS + 1, false)).toBe(true)
  })
})

describe('wsReconnectDelayMs', () => {
  it('uses exponential backoff for stale and normal closes', () => {
    expect(wsReconnectDelayMs(0, true)).toBe(1000)
    expect(wsReconnectDelayMs(0, false)).toBe(1000)
    expect(wsReconnectDelayMs(1, false)).toBe(2000)
    expect(wsReconnectDelayMs(5, false)).toBe(30_000)
  })
})
