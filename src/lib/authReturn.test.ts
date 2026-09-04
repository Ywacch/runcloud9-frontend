import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  consumeAuthReturnTo,
  loginPathWithReturnTo,
  peekAuthReturnTo,
  primeAuthReturnTo,
  sanitizeAuthReturnPath,
  setAuthReturnTo,
} from './authReturn'

const storage = new Map<string, string>()

describe('authReturn', () => {
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

  it('allowlists safe in-app paths', () => {
    expect(sanitizeAuthReturnPath('/dashboard')).toBe('/dashboard')
    expect(sanitizeAuthReturnPath('/profile')).toBe('/profile')
    expect(sanitizeAuthReturnPath('/canvas')).toBe('/canvas')
    expect(sanitizeAuthReturnPath('/billing/success')).toBe('/billing/success')
  })

  it('rejects login, auth, and marketing bounce targets', () => {
    expect(sanitizeAuthReturnPath('/login')).toBeNull()
    expect(sanitizeAuthReturnPath('/auth/callback')).toBeNull()
    expect(sanitizeAuthReturnPath('/')).toBeNull()
    expect(sanitizeAuthReturnPath('https://evil.test/profile')).toBeNull()
    expect(sanitizeAuthReturnPath('//evil.test/profile')).toBeNull()
  })

  it('stores and consumes return paths', () => {
    setAuthReturnTo('/profile')
    expect(peekAuthReturnTo()).toBe('/profile')
    expect(consumeAuthReturnTo('/dashboard')).toBe('/profile')
    expect(peekAuthReturnTo()).toBeNull()
    expect(consumeAuthReturnTo('/dashboard')).toBe('/dashboard')
  })

  it('builds login URLs with encoded returnTo', () => {
    expect(loginPathWithReturnTo('/profile')).toBe('/login?returnTo=%2Fprofile')
    expect(loginPathWithReturnTo('/login')).toBe('/login')
  })

  it('primes auth return path only when unset unless overwrite is requested', () => {
    primeAuthReturnTo('/dashboard')
    expect(peekAuthReturnTo()).toBe('/dashboard')

    primeAuthReturnTo('/profile')
    expect(peekAuthReturnTo()).toBe('/dashboard')

    primeAuthReturnTo('/canvas', { overwrite: true })
    expect(peekAuthReturnTo()).toBe('/canvas')
  })
})
