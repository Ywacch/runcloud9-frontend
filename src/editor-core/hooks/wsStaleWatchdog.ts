import { WS_STALE_RECONNECT_MS } from '../playback/playbackConfig'

export const WS_STALE_CHECK_INTERVAL_MS = 2_000
export const WS_STALE_FAST_RECONNECT_MS = 500

/** WebSocket.OPEN — inlined so tests do not need a WebSocket impl. */
export const WEBSOCKET_OPEN = 1

export function isWsConnectionStale(
  readyState: number,
  lastFrameAt: number,
  now: number,
  staleThresholdMs: number = WS_STALE_RECONNECT_MS,
): boolean {
  if (readyState !== WEBSOCKET_OPEN) return false
  if (lastFrameAt <= 0) return false
  return now - lastFrameAt > staleThresholdMs
}

export function wsReconnectDelayMs(
  retryCount: number,
  staleClose: boolean,
): number {
  if (staleClose) return WS_STALE_FAST_RECONNECT_MS
  return Math.min(30_000, 1000 * 2 ** retryCount)
}
