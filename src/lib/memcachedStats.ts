export function sumMemcachedStat(
  stats: Record<string, Record<string, string>> | undefined,
  key: string,
): number | null {
  if (!stats) return null
  let sum = 0
  let seen = false
  for (const server of Object.values(stats)) {
    const raw = server[key]
    if (raw == null || raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    sum += n
    seen = true
  }
  return seen ? sum : null
}
