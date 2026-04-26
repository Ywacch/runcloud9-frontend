import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWsBaseForApi, deleteDeployment, startLoadGen, stopLoadGen } from './api'
import { getAccessToken } from './auth'

vi.mock('./auth', () => ({
  getAccessToken: vi.fn(),
}))

describe('auth headers for protected deployment calls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends Authorization on start/stop loadgen and delete', async () => {
    vi.mocked(getAccessToken).mockReturnValue('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      status: 200,
      statusText: 'OK',
    })
    vi.stubGlobal('fetch', fetchMock)

    await startLoadGen('dep-1', { rps: 20 })
    await stopLoadGen('dep-1')
    await deleteDeployment('dep-1')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const postHeaders = fetchMock.mock.calls[0]?.[1]?.headers
    const deleteLgHeaders = fetchMock.mock.calls[1]?.[1]?.headers
    const deleteDepHeaders = fetchMock.mock.calls[2]?.[1]?.headers
    expect(postHeaders.Authorization).toBe('Bearer abc123')
    expect(deleteLgHeaders.Authorization).toBe('Bearer abc123')
    expect(deleteDepHeaders.Authorization).toBe('Bearer abc123')
  })

  it('throws ApiError with status/message on unauthorized', async () => {
    vi.mocked(getAccessToken).mockReturnValue('expired')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'invalid token' }),
      }),
    )

    await expect(stopLoadGen('dep-2')).rejects.toMatchObject({
      status: 401,
      rawMessage: 'invalid token',
    })
  })
})

describe('buildWsBaseForApi', () => {
  it('uses same-origin ws for relative API base', () => {
    const current = { protocol: 'https:', host: 'www.runcloud9.io' } as Location
    expect(buildWsBaseForApi('/deployments', current)).toBe(
      'wss://www.runcloud9.io/deployments',
    )
  })

  it('uses API host for absolute API base', () => {
    const current = { protocol: 'https:', host: 'www.runcloud9.io' } as Location
    expect(
      buildWsBaseForApi('https://api.runcloud9.io/deployments', current),
    ).toBe('wss://api.runcloud9.io/deployments')
  })
})
