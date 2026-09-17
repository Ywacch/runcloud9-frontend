import { WS_STALE_RECONNECT_MS } from '../playback/playbackConfig'

export const WS_STALE_CHECK_INTERVAL_MS = 2_000

/** WebSocket.OPEN — inlined so tests do not need a WebSocket impl. */
export const WEBSOCKET_OPEN = 1

export type WsStaleOptions = {
  connectedAt?: number
  staleThresholdMs?: number
}

export function isWsConnectionStale(
  readyState: number,
  lastFrameAt: number,
  now: number,
  options: WsStaleOptions = {},
): boolean {
  const staleThresholdMs = options.staleThresholdMs ?? WS_STALE_RECONNECT_MS
  if (readyState !== WEBSOCKET_OPEN) return false
  if (lastFrameAt > 0) {
    return now - lastFrameAt > staleThresholdMs
  }
  const connectedAt = options.connectedAt
  if (connectedAt == null || connectedAt <= 0) return false
  return now - connectedAt > staleThresholdMs
}

export function wsReconnectDelayMs(
  retryCount: number,
  _staleClose?: boolean,
): number {
  return Math.min(30_000, 1000 * 2 ** retryCount)
}
