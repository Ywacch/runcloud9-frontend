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

/** Policy name plus a compact explanation; native option tooltips are inconsistent. */
export const REDIS_EVICTION_POLICY_LABEL: Record<RedisEvictionPolicy, string> = {
  noeviction: 'noeviction — reject new writes',
  'allkeys-lru': 'allkeys-lru — least recently used',
  'volatile-lru': 'volatile-lru — TTL keys, least recently used',
  'allkeys-lfu': 'allkeys-lfu — least frequently used',
  'volatile-lfu': 'volatile-lfu — TTL keys, least frequently used',
  'allkeys-random': 'allkeys-random — random key',
  'volatile-random': 'volatile-random — random TTL key',
  'volatile-ttl': 'volatile-ttl — closest to expiring',
}

/** Visible below the select for the currently selected policy. */
export const REDIS_EVICTION_POLICY_DESCRIPTION: Record<RedisEvictionPolicy, string> =
  {
    noeviction: 'Do not remove keys. New writes fail when memory is full.',
    'allkeys-lru': 'Any key can be removed. Redis removes keys used least recently.',
    'volatile-lru':
      'Only keys with a TTL can be removed. Redis removes those used least recently.',
    'allkeys-lfu': 'Any key can be removed. Redis removes keys used least often.',
    'volatile-lfu':
      'Only keys with a TTL can be removed. Redis removes those used least often.',
    'allkeys-random': 'Any key can be removed. Redis chooses keys at random.',
    'volatile-random':
      'Only keys with a TTL can be removed. Redis chooses among them at random.',
    'volatile-ttl':
      'Only keys with a TTL can be removed. Redis removes those with the shortest time left.',
  }

export function isVolatileRedisEvictionPolicy(
  policy: RedisEvictionPolicy,
): boolean {
  return policy.startsWith('volatile-')
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
