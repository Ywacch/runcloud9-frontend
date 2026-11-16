export type StreamTransport = 'sse' | 'ws'

/** Unset or any value other than "true" keeps WebSocket. */
export function sseStreamsEnabled(): boolean {
  return import.meta.env.VITE_STREAM_SSE === 'true'
}

/** Two failed opens select ws. A later successful open resets the count in the hook. */
export function nextStreamTransport(
  flagOn: boolean,
  failedOpens: number,
): StreamTransport {
  if (!flagOn) return 'ws'
  if (failedOpens >= 2) return 'ws'
  return 'sse'
}