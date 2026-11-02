import { describe, expect, it } from 'vitest'
import { cacheDeployedConfigRows } from './cacheDeployedConfig'

describe('cacheDeployedConfigRows', () => {
  it('omits redis memory and policy rows for memcached', () => {
    const rows = cacheDeployedConfigRows({
      engine: 'memcached',
      strategy: 'cache-aside',
      cpuLimit: '125m',
      memoryLimit: '230 MiB',
      policy: 'allkeys-lru',
      ttl: '300 s',
      client: 'App Server pool',
    })
    const keys = rows.map((row) => row.key)
    expect(keys).not.toContain('maxmemory')
    expect(keys).not.toContain('policy')
    expect(rows.find((row) => row.key === 'memory limit')?.value).toBe('230 MiB')
    expect(rows.find((row) => row.key === 'eviction')?.value).toBe('LRU (fixed)')
  })

  it('keeps redis rows', () => {
    const rows = cacheDeployedConfigRows({
      engine: 'redis',
      strategy: 'cache-aside',
      cpuLimit: '125m',
      memoryLimit: '230 MiB',
      policy: 'allkeys-lru',
      ttl: '300 s',
    })
    expect(rows.map((row) => row.key)).toEqual([
      'strategy',
      'cpu limit',
      'maxmemory',
      'policy',
      'ttl',
    ])
  })
})
