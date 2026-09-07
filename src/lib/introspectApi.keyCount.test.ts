import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEPLOYMENTS_API_PREFIX } from './api'
import { getAccessToken } from './auth'
import {
  fetchCacheStats,
  type CacheStatsResult,
  type KeyScanResult,
} from './introspectApi'

vi.mock('./auth', () => ({
  getAccessToken: vi.fn(),
}))

describe('KeyScanResult', () => {
  it('accepts optional keyCount from introspect keys response', () => {
    const payload: KeyScanResult = {
      keys: [{ key: 'user:1', type: 'string', ttl: -1, memory: 64 }],
      cursor: 0,
      keyCount: 42,
    }
    expect(payload.keyCount).toBe(42)
  })
})

describe('CacheStatsResult', () => {
  it('accepts keyCount from introspect stats response', () => {
    const payload: CacheStatsResult = { keyCount: 42 }
    expect(payload.keyCount).toBe(42)
  })
})

describe('fetchCacheStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs introspect cache stats with auth', async () => {
    vi.mocked(getAccessToken).mockReturnValue('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ keyCount: 17 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCacheStats('dep-1', 'cache')

    expect(result.keyCount).toBe(17)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toBe(
      `${DEPLOYMENTS_API_PREFIX}/dep-1/introspect/cache/stats`,
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >
    expect(headers.Authorization).toBe('Bearer abc123')
  })
})
