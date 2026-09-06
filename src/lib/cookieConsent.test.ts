import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetCookieConsentForTests,
  acceptEssentialCookiesOnly,
  hasAnalyticsConsent,
  readCookieConsent,
  setCookieConsent,
} from './cookieConsent'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

describe('cookieConsent', () => {
  beforeEach(() => {
    installLocalStorageMock()
    __resetCookieConsentForTests()
  })

  it('returns null when unset or invalid', () => {
    expect(readCookieConsent()).toBeNull()
    localStorage.setItem('runcloud9.cookieConsent', 'garbage')
    expect(readCookieConsent()).toBeNull()
  })

  it('reads essential and all choices', () => {
    setCookieConsent('essential')
    expect(readCookieConsent()).toBe('essential')
    expect(hasAnalyticsConsent()).toBe(false)

    setCookieConsent('all')
    expect(readCookieConsent()).toBe('all')
    expect(hasAnalyticsConsent()).toBe(true)
  })

  it('essential only does not grant analytics consent', () => {
    acceptEssentialCookiesOnly()
    expect(readCookieConsent()).toBe('essential')
    expect(hasAnalyticsConsent()).toBe(false)
  })
})
