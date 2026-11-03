/** Inspector latency in milliseconds. Null means the series is absent. */
export function formatCacheLatencyMs(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null
  if (ms < 10) return ms.toFixed(1)
  return String(Math.round(ms))
}
