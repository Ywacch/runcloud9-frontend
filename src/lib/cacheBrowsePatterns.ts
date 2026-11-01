/** Cache data-browser patterns when a work queue shares the Redis instance. */

export function workQueueOnRedis(engine: string | null | undefined): boolean {
  return (engine ?? '').trim().toLowerCase() === 'redis'
}

/**
 * Timeline (and other cache) patterns stay first. Stream keys are appended
 * only when the work queue runs on this Redis, so a RabbitMQ topology does
 * not show an empty queue tab.
 */
export function cacheBrowsePatterns(
  cachePatterns: readonly string[] | undefined,
  streamKeys: readonly string[],
  queueOnRedis: boolean,
): string[] {
  const out = [...(cachePatterns ?? [])]
  if (!queueOnRedis) return out
  const seen = new Set(out)
  for (const raw of streamKeys) {
    const key = raw.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function cachePatternLabel(pattern: string, streamKeys: readonly string[]): string {
  if (streamKeys.some((k) => k.trim() === pattern)) {
    return streamKeys.filter((k) => k.trim()).length > 1 ? `Work queue · ${pattern}` : 'Work queue'
  }
  if (pattern === 'timeline:*') return 'Timelines'
  return pattern
}
