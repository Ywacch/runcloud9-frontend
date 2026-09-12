import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from './api'
import {
  clearCachedCurrentUser,
  readCachedCurrentUser,
  writeCachedCurrentUser,
} from './currentUserCache'

const storage = new Map<string, string>()

const internalProfile: CurrentUserResponse = {
  userId: 'user-1',
  isInternal: true,
  isPremium: false,
  premiumExpiresAt: null,
  effectiveTier: 'internal',
  quotaTier: 'internal',
  limits: {
    maxConcurrent: 40,
    sessionDefaultMins: 9,
    sessionCapMins: 30,
    maxSessionsPerMonth: null,
    allTemplates: true,
    maxAppServerReplicas: 3,
    allowLoadBalancer: true,
    allowMQWorker: true,
    allowProxyCache: true,
    maxInstanceSize: 'large',
    maxLoadgenRps: 2000,
  },
  sessionsUsedThisMonth: 0,
  sessionsRemainingThisMonth: null,
}

describe('currentUserCache', () => {
  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    })
  })

  it('round-trips a matching user id', () => {
    writeCachedCurrentUser('user-1', internalProfile)
    expect(readCachedCurrentUser('user-1')).toEqual(internalProfile)
  })

  it('ignores cache for a different user', () => {
    writeCachedCurrentUser('user-1', internalProfile)
    expect(readCachedCurrentUser('user-2')).toBeNull()
  })

  it('skips the Vite preview fixture user', () => {
    writeCachedCurrentUser('dev-preview-user', {
      ...internalProfile,
      userId: 'dev-preview-user',
    })
    expect(readCachedCurrentUser('dev-preview-user')).toBeNull()
  })

  it('clears the cache', () => {
    writeCachedCurrentUser('user-1', internalProfile)
    clearCachedCurrentUser()
    expect(readCachedCurrentUser('user-1')).toBeNull()
  })
})
