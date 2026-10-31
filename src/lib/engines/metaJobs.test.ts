import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MetaJobsResponse } from '../api'
import {
  loadMetaJobs,
  resetMetaJobsCache,
  setMetaJobsCacheForTest,
} from './metaJobs'

const body: MetaJobsResponse = {
  catalogVersion: '1',
  jobs: [],
  engines: [],
  pairs: [],
  guarantees: [],
}

describe('loadMetaJobs', () => {
  afterEach(() => {
    resetMetaJobsCache()
    vi.unstubAllGlobals()
  })

  it('returns cached body on 304', async () => {
    setMetaJobsCacheForTest(body, '"v1"')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({ 'If-None-Match': '"v1"' })
        return new Response(null, { status: 304 })
      }),
    )
    await expect(loadMetaJobs()).resolves.toEqual(body)
  })

  it('stores ETag on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(body, { headers: { ETag: '"fresh"' } }),
      ),
    )
    await expect(loadMetaJobs()).resolves.toEqual(body)
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304 }))
    await expect(loadMetaJobs()).resolves.toEqual(body)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
