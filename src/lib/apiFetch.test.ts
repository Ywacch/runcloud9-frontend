import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiError'
import { apiFetch, DEFAULT_API_FETCH_TIMEOUT_MS } from './apiFetch'

function abortAwareFetchMock() {
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      })
    }),
  )
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns the response when ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await apiFetch('/me')
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/me', {
      signal: expect.any(AbortSignal),
    })
  })

  it('throws ApiError with parsed message on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => JSON.stringify({ error: 'upstream down' }),
      }),
    )

    await expect(apiFetch('/deployments/dep-1')).rejects.toMatchObject({
      status: 502,
      rawMessage: 'upstream down',
    })
    await expect(apiFetch('/deployments/dep-1')).rejects.toBeInstanceOf(ApiError)
  })

  it('aborts when timeout elapses', async () => {
    vi.stubGlobal('fetch', abortAwareFetchMock())

    const pending = apiFetch('/deployments/dep-1', { timeoutMs: 1000 })
    const settled = pending.then(
      () => 'resolved',
      (err: unknown) => err,
    )
    await vi.advanceTimersByTimeAsync(1000)
    await expect(settled).resolves.toMatchObject({ name: 'AbortError' })
  })

  it('uses the default 20s timeout', async () => {
    vi.stubGlobal('fetch', abortAwareFetchMock())

    const pending = apiFetch('/deployments/dep-1')
    const settled = pending.then(
      () => 'resolved',
      (err: unknown) => err,
    )
    await vi.advanceTimersByTimeAsync(DEFAULT_API_FETCH_TIMEOUT_MS)
    await expect(settled).resolves.toMatchObject({ name: 'AbortError' })
  })

  it('forwards caller abort to fetch', async () => {
    const caller = new AbortController()
    vi.stubGlobal('fetch', abortAwareFetchMock())

    const pending = apiFetch('/deployments/dep-1', { signal: caller.signal })
    const settled = pending.then(
      () => 'resolved',
      (err: unknown) => err,
    )
    caller.abort()
    await expect(settled).resolves.toMatchObject({ name: 'AbortError' })
  })
})
