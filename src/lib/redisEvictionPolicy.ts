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

export const REDIS_EVICTION_POLICY_LABEL: Record<RedisEvictionPolicy, string> = {
  noeviction: 'noeviction — never evict (OOM on write)',
  'allkeys-lru': 'allkeys-lru — drop least-recently-used keys',
  'volatile-lru': 'volatile-lru — LRU among keys with TTL',
  'allkeys-lfu': 'allkeys-lfu — drop least-frequently-used keys',
  'volatile-lfu': 'volatile-lfu — LFU among keys with TTL',
  'allkeys-random': 'allkeys-random — drop random keys',
  'volatile-random': 'volatile-random — random among keys with TTL',
  'volatile-ttl': 'volatile-ttl — drop soonest-to-expire keys',
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
