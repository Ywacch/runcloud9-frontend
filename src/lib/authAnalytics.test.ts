import { describe, expect, it } from 'vitest'
import {
  categorizeAuthCallbackOAuthRedirect,
  isNewOAuthUser,
  oauthAnalyticsProvider,
} from './authAnalytics'

describe('authAnalytics', () => {
  it('maps access_denied to oauth_denied', () => {
    const search = new URLSearchParams('error=access_denied')
    expect(categorizeAuthCallbackOAuthRedirect(search)).toBe('oauth_denied')
  })

  it('maps signups disabled copy to signups_disabled', () => {
    const search = new URLSearchParams(
      'error=server_error&error_description=Signups+not+allowed+for+this+project',
    )
    expect(categorizeAuthCallbackOAuthRedirect(search)).toBe('signups_disabled')
  })

  it('maps other oauth redirect failures to unauthorized', () => {
    const search = new URLSearchParams('error=server_error')
    expect(categorizeAuthCallbackOAuthRedirect(search)).toBe('unauthorized')
  })

  it('accepts only google and github providers', () => {
    expect(oauthAnalyticsProvider('google')).toBe('google')
    expect(oauthAnalyticsProvider('github')).toBe('github')
    expect(oauthAnalyticsProvider('email')).toBeUndefined()
  })

  it('detects new users when created_at and last_sign_in_at are within 10s', () => {
    const now = new Date('2026-01-01T12:00:00.000Z').toISOString()
    const fiveSecondsLater = new Date('2026-01-01T12:00:05.000Z').toISOString()
    expect(
      isNewOAuthUser({
        created_at: now,
        last_sign_in_at: fiveSecondsLater,
      }),
    ).toBe(true)
    expect(
      isNewOAuthUser({
        created_at: now,
        last_sign_in_at: new Date('2026-01-01T12:01:00.000Z').toISOString(),
      }),
    ).toBe(false)
    expect(isNewOAuthUser({ created_at: now, last_sign_in_at: undefined })).toBe(
      false,
    )
  })
})
