export type CacheConfigRow = { key: string; value: string }

export function cacheDeployedConfigRows(input: {
  engine: string
  strategy: string
  cpuLimit: string
  memoryLimit: string
  policy: string
  ttl: string
  client?: string
}): CacheConfigRow[] {
  const engine = input.engine.trim().toLowerCase()
  const rows: CacheConfigRow[] = [
    { key: 'strategy', value: input.strategy },
    { key: 'cpu limit', value: input.cpuLimit },
  ]
  if (engine === 'memcached') {
    rows.push(
      { key: 'memory limit', value: input.memoryLimit },
      { key: 'eviction', value: 'LRU (fixed)' },
    )
  } else {
    rows.push(
      { key: 'maxmemory', value: input.memoryLimit },
      { key: 'policy', value: input.policy },
    )
  }
  rows.push({ key: 'ttl', value: input.ttl })
  if (input.client) rows.push({ key: 'client', value: input.client })
  return rows
}
