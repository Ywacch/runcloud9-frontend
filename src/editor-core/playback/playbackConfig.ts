/** Display lag between wall clock and chart playhead (Hybrid C). */
export const BUFFER_LAG_MS = 5_000

export const BUFFER_MAX_SAMPLES = 30

/** Stub constant for F3 stale detection. */
export const STALE_THRESHOLD_MS = 15_000

/** Reconnect when WS is OPEN but no frames arrive within this window. */
export const WS_STALE_RECONNECT_MS = 8_000

export const MAX_DELTA_MS = 200

const MAX_HISTORY_POINTS = 30

export const MAX_PLAYBACK_HISTORY = MAX_HISTORY_POINTS

/** Playback on by default; set `VITE_METRICS_PLAYBACK=false` to disable. */
export function isMetricsPlaybackEnabled(): boolean {
  return import.meta.env.VITE_METRICS_PLAYBACK !== 'false'
}
