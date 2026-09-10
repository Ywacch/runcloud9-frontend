import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMe } from './api'
import { ApiError } from './apiError'
import { refreshCurrentUser } from './auth'
import { DEV_ENGINEER_USER } from './devAccountPreview'
import { supabase } from './supabase'
import { useAuthStore } from '../product/stores/authStore'

vi.mock('./api', () => ({
  getMe: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

const engineerProfile = {
  userId: 'user-1',
  isInternal: false,
  isPremium: true,
  premiumExpiresAt: '2026-12-31T00:00:00Z',
  effectiveTier: 'engineer' as const,
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
    maxInstanceSize: 'large',
    maxLoadgenRps: 1000,
  },
  sessionsUsedThisMonth: 2,
  sessionsRemainingThisMonth: 18,
}

describe('refreshCurrentUser', () => {
  beforeEach(() => {
    vi.mocked(getMe).mockReset()
    vi.mocked(supabase.auth.signOut).mockClear()
    useAuthStore.setState({
      session: {
        access_token: 'tok',
        user: { id: 'user-1' },
      } as never,
      currentUser: null,
      userRecord: null,
      isPremium: false,
      pendingDeployAfterAuth: false,
    })
  })

  it('hydrates currentUser from GET /me', async () => {
    vi.mocked(getMe).mockResolvedValue(engineerProfile)
    await refreshCurrentUser()

    const state = useAuthStore.getState()
    expect(state.currentUser).toEqual(engineerProfile)
    expect(state.isPremium).toBe(true)
    expect(state.userRecord).toEqual({
      isInternal: false,
      isPremium: true,
      premiumExpiresAt: '2026-12-31T00:00:00Z',
    })
  })

  it('clears session on 401 from GET /me', async () => {
    vi.mocked(getMe).mockRejectedValue(new ApiError(401, 'invalid token'))
    await refreshCurrentUser()

    expect(useAuthStore.getState().session).toBeNull()
    expect(supabase.auth.signOut).toHaveBeenCalled()
    if (import.meta.env.DEV) {
      expect(useAuthStore.getState().currentUser).toEqual(DEV_ENGINEER_USER)
    } else {
      expect(useAuthStore.getState().currentUser).toBeNull()
    }
  })

  it('clears session on failed to load user from GET /me', async () => {
    vi.mocked(getMe).mockRejectedValue(new ApiError(500, 'failed to load user'))
    await refreshCurrentUser()

    expect(useAuthStore.getState().session).toBeNull()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('falls back to null currentUser on other errors', async () => {
    vi.mocked(getMe).mockRejectedValue(new Error('network'))
    await refreshCurrentUser()

    if (import.meta.env.DEV) {
      expect(useAuthStore.getState().currentUser).toEqual(DEV_ENGINEER_USER)
    } else {
      expect(useAuthStore.getState().currentUser).toBeNull()
    }
    expect(useAuthStore.getState().session).not.toBeNull()
  })
})
