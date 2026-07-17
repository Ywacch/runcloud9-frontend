/** Matches ganymede pkg/deployer/redis_args.go normalizeRedisEvictionPolicy. */
export const REDIS_EVICTION_POLICIES = [
  'noeviction',
  'allkeys-lru',
  'volatile-lru',
  'allkeys-lfu',
  'volatile-lfu',
  'allkeys-random',
  'volatile-random',
  'volatile-ttl',
] as const

export type RedisEvictionPolicy = (typeof REDIS_EVICTION_POLICIES)[number]

/** Short option label — policy name only (descriptions go on hover). */
export const REDIS_EVICTION_POLICY_LABEL: Record<RedisEvictionPolicy, string> = {
  noeviction: 'noeviction',
  'allkeys-lru': 'allkeys-lru',
  'volatile-lru': 'volatile-lru',
  'allkeys-lfu': 'allkeys-lfu',
  'volatile-lfu': 'volatile-lfu',
  'allkeys-random': 'allkeys-random',
  'volatile-random': 'volatile-random',
  'volatile-ttl': 'volatile-ttl',
}

/** Shown via title/tooltip when hovering an option or the closed select. */
export const REDIS_EVICTION_POLICY_DESCRIPTION: Record<RedisEvictionPolicy, string> =
  {
    noeviction: 'Never evict (OOM on write)',
    'allkeys-lru': 'Drop least-recently-used keys',
    'volatile-lru': 'LRU among keys with TTL',
    'allkeys-lfu': 'Drop least-frequently-used keys',
    'volatile-lfu': 'LFU among keys with TTL',
    'allkeys-random': 'Drop random keys',
    'volatile-random': 'Random among keys with TTL',
    'volatile-ttl': 'Drop soonest-to-expire keys',
  }

export function normalizeRedisEvictionPolicy(raw: unknown): RedisEvictionPolicy {
  const p = String(raw ?? '')
    .trim()
    .toLowerCase()
  if ((REDIS_EVICTION_POLICIES as readonly string[]).includes(p)) {
    return p as RedisEvictionPolicy
  }
  return 'allkeys-lru'
}
