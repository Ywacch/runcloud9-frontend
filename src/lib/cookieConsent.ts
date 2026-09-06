import { initAnalytics, resetAnalytics } from './analytics'

export type CookieConsent = 'essential' | 'all'

const STORAGE_KEY = 'runcloud9.cookieConsent'

const reopenListeners = new Set<() => void>()

function isCookieConsent(value: unknown): value is CookieConsent {
  return value === 'essential' || value === 'all'
}

/** Read persisted consent, or null when unset or invalid. */
export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return null
    if (isCookieConsent(raw)) return raw
    return null
  } catch {
    return null
  }
}

/** Persist consent choice in localStorage. */
export function setCookieConsent(value: CookieConsent): void {
  localStorage.setItem(STORAGE_KEY, value)
}

/** True only when the user accepted analytics cookies. */
export function hasAnalyticsConsent(): boolean {
  return readCookieConsent() === 'all'
}

/** Re-open the cookie banner from footer "Cookie settings". */
export function requestCookieSettings(): void {
  for (const listener of reopenListeners) {
    listener()
  }
}

/** Subscribe to cookie-settings reopen requests. Returns an unsubscribe function. */
export function onCookieSettingsRequested(listener: () => void): () => void {
  reopenListeners.add(listener)
  return () => {
    reopenListeners.delete(listener)
  }
}

export function acceptAnalyticsCookies(): void {
  setCookieConsent('all')
  void initAnalytics()
}

export function acceptEssentialCookiesOnly(): void {
  setCookieConsent('essential')
  resetAnalytics()
}

/** Test helper — clears persisted consent. */
export function __resetCookieConsentForTests(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
