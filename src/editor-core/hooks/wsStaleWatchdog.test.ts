import { describe, expect, it } from 'vitest'
import { WS_STALE_RECONNECT_MS } from '../playback/playbackConfig'
import {
  WEBSOCKET_OPEN,
  WS_STALE_FAST_RECONNECT_MS,
  isWsConnectionStale,
  wsReconnectDelayMs,
} from './wsStaleWatchdog'

describe('isWsConnectionStale', () => {
  const now = 100_000

  it('returns false before the first frame', () => {
    expect(isWsConnectionStale(WEBSOCKET_OPEN, 0, now)).toBe(false)
  })

  it('returns false while within the stale threshold', () => {
    expect(
      isWsConnectionStale(
        WEBSOCKET_OPEN,
        now - WS_STALE_RECONNECT_MS,
        now,
      ),
    ).toBe(false)
  })

  it('returns true when OPEN and idle past the threshold', () => {
    expect(
      isWsConnectionStale(
        WEBSOCKET_OPEN,
        now - WS_STALE_RECONNECT_MS - 1,
        now,
      ),
    ).toBe(true)
  })

  it('returns false when the socket is not open', () => {
    expect(
      isWsConnectionStale(0, now - WS_STALE_RECONNECT_MS - 1, now),
    ).toBe(false)
  })
})

describe('wsReconnectDelayMs', () => {
  it('uses a fast reconnect after an intentional stale close', () => {
    expect(wsReconnectDelayMs(4, true)).toBe(WS_STALE_FAST_RECONNECT_MS)
  })

  it('uses exponential backoff for normal closes', () => {
    expect(wsReconnectDelayMs(0, false)).toBe(1000)
    expect(wsReconnectDelayMs(1, false)).toBe(2000)
    expect(wsReconnectDelayMs(5, false)).toBe(30_000)
  })
})
