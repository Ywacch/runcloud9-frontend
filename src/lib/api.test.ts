import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildWsBaseForApi,
  deleteDeployment,
  getDeployment,
  getMe,
  getTemplateLoadgen,
  listActiveDeployments,
  listDeploymentHistory,
  startLoadGen,
  stopLoadGen,
  updateLoadGen,
} from './api'
import { DEV_ENGINEER_USER } from './devAccountPreview'
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

  it('includes scheduleId in startLoadGen JSON body', async () => {
    vi.mocked(getAccessToken).mockReturnValue('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      status: 200,
      statusText: 'OK',
    })
    vi.stubGlobal('fetch', fetchMock)

    await startLoadGen('dep-1', {
      rps: 20,
      template: 'social-feed',
      scheduleId: 'world_cup_goal',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.scheduleId).toBe('world_cup_goal')
  })

  it('includes actorParams in startLoadGen JSON body', async () => {
    vi.mocked(getAccessToken).mockReturnValue('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      status: 200,
      statusText: 'OK',
    })
    vi.stubGlobal('fetch', fetchMock)

    await startLoadGen('dep-1', {
      rps: 20,
      actorParams: { celebrityPostPct: 90 },
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.actorParams).toEqual({ celebrityPostPct: 90 })
  })

  it('sends Authorization on PATCH updateLoadGen', async () => {
    vi.mocked(getAccessToken).mockReturnValue('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      status: 200,
      statusText: 'OK',
    })
    vi.stubGlobal('fetch', fetchMock)

    await updateLoadGen('dep-1', 120)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/dep-1/loadgen')
    expect(init?.method).toBe('PATCH')
    expect(init?.headers.Authorization).toBe('Bearer abc123')
    expect(JSON.parse(String(init?.body))).toEqual({ rps: 120 })
  })

  it('fetches template loadgen config from /templates/{id}/loadgen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        defaultRps: 50,
        schedules: [{ id: 'steady', label: 'Steady', phases: [] }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const cfg = await getTemplateLoadgen('social-feed')
    expect(cfg.defaultRps).toBe(50)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/templates/social-feed/loadgen')
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

describe('getMe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends Authorization and returns profile', async () => {
    vi.mocked(getAccessToken).mockReturnValue('tok-me')
    const profile = {
      userId: 'u1',
      isInternal: false,
      isPremium: true,
      premiumExpiresAt: '2026-12-31T00:00:00Z',
      effectiveTier: 'engineer',
      quotaTier: 'engineer',
      limits: {
        maxConcurrent: 1,
        sessionDefaultMins: 9,
        sessionCapMins: 15,
        maxSessionsPerMonth: 20,
        allTemplates: true,
        maxAppServerReplicas: 3,
        allowLoadBalancer: true,
        allowMQWorker: true,
        allowProxyCache: true,
      },
      sessionsUsedThisMonth: 2,
      sessionsRemainingThisMonth: 18,
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => profile,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getMe()).resolves.toEqual(profile)
    expect(fetchMock).toHaveBeenCalledWith('/me', {
      headers: { Authorization: 'Bearer tok-me' },
    })
  })

  it('returns the dev preview user when /me is down in Vite dev', async () => {
    vi.mocked(getAccessToken).mockReturnValue('tok-me')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'bad gateway',
    })
    vi.stubGlobal('fetch', fetchMock)

    if (!import.meta.env.DEV) {
      await expect(getMe()).rejects.toMatchObject({ status: 502 })
      return
    }

    await expect(getMe()).resolves.toEqual(DEV_ENGINEER_USER)
  })

  it('returns the dev preview user when unsigned in Vite dev', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    if (!import.meta.env.DEV) {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'missing token' }),
      })
      await expect(getMe()).rejects.toMatchObject({ status: 401 })
      return
    }

    await expect(getMe()).resolves.toEqual(DEV_ENGINEER_USER)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws ApiError on 401', async () => {
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

    await expect(getMe()).rejects.toMatchObject({
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

describe('listDeploymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends Authorization Bearer and correct limit', async () => {
    vi.mocked(getAccessToken).mockReturnValue('hist-tok')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    await listDeploymentHistory(20)

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(opts.headers.Authorization).toBe('Bearer hist-tok')
    expect(url).toContain('/deployments/history')
    expect(url).toContain('limit=20')
  })

  it('clamps limit to [1, 50]', async () => {
    vi.mocked(getAccessToken).mockReturnValue('tok')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    await listDeploymentHistory(200)
    await listDeploymentHistory(-5)

    expect(fetchMock.mock.calls[0][0] as string).toContain('limit=50')
    expect(fetchMock.mock.calls[1][0] as string).toContain('limit=1')
  })

  it('maps optional peak fields; omitted stay undefined', async () => {
    vi.mocked(getAccessToken).mockReturnValue('tok')
    const row = {
      id: 'abc123',
      namespace: 'ns-abc',
      template: 'url-shortener',
      archetype: 'standard',
      status: 'terminated',
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-01T01:00:00Z',
      durationSeconds: 300,
      peakRps: 120,
      // peakP99Ms omitted
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [row],
    }))

    const [item] = await listDeploymentHistory(20)
    expect(item.durationSeconds).toBe(300)
    expect(item.peakRps).toBe(120)
    expect(item.peakP99Ms).toBeUndefined()
  })

  it('returns preview history when unsigned in Vite dev', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    if (!import.meta.env.DEV) {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'missing token' }),
      })
      await expect(listDeploymentHistory(20)).rejects.toMatchObject({ status: 401 })
      return
    }

    const rows = await listDeploymentHistory(2)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.template).toBe('url-shortener')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws ApiError on failure', async () => {
    vi.mocked(getAccessToken).mockReturnValue('tok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => JSON.stringify({ error: 'access denied' }),
    }))

    await expect(listDeploymentHistory(20)).rejects.toMatchObject({
      status: 403,
      rawMessage: 'access denied',
    })
  })
})

describe('dev account preview deployments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAccessToken).mockReturnValue(null)
  })

  it('lists a running preview deploy without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    if (!import.meta.env.DEV) return

    const rows = await listActiveDeployments()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('running')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns preview metrics by namespace', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    if (!import.meta.env.DEV) return

    const rec = await getDeployment('cloud9-url-shortener-devpreview-c4d5e6')
    expect(rec.template).toBe('url-shortener')
    expect(rec.metricsSummary).toMatchObject({ peak_rps: 86 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
