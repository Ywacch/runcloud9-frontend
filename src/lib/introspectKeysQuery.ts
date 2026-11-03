/** GET keys path. Omits pattern when unset so Memcached uses the template whitelist. */
export function keysListPath(pattern?: string, cursor?: number, count?: number): string {
  const params = new URLSearchParams()
  const trimmed = pattern?.trim()
  if (trimmed) params.set('pattern', trimmed)
  if (cursor != null) params.set('cursor', String(cursor))
  if (count != null) params.set('count', String(count))
  const qs = params.toString()
  return qs ? `keys?${qs}` : 'keys'
}
