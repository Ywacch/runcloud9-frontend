import { describe, expect, it } from 'vitest'
import {
  RESET_PASSWORD_SUCCESS_COPY,
  isAuthCallbackOAuthError,
  mapAuthCallbackError,
  mapSupabaseOAuthError,
  mapSupabaseOtpError,
  mapSupabaseSignInError,
} from './authErrorMessage'

describe('authErrorMessage', () => {
  it('adds OAuth hint for invalid password sign-in', () => {
    const msg = mapSupabaseSignInError(new Error('Invalid login credentials'))
    expect(msg).toContain('Email or password is incorrect.')
    expect(msg).toContain('Google or GitHub')
  })

  it('maps disabled OAuth provider copy', () => {
    expect(mapSupabaseOAuthError(new Error('provider is not enabled'))).toBe(
      'This sign-in method is not available yet. Try another sign-in option.',
    )
    expect(mapSupabaseOAuthError(new Error('provider_disabled'))).toContain(
      'not available yet',
    )
  })

  it('maps signups-disabled OAuth copy', () => {
    expect(
      mapSupabaseOAuthError(new Error('Signups not allowed for this instance')),
    ).toContain('New accounts are not open right now')
    expect(
      mapAuthCallbackError(new Error('Signups not allowed for this instance')),
    ).toContain('New accounts are not open right now')
  })

  it('maps GitHub email visibility errors', () => {
    const cases = [
      'Error getting user email from external provider',
      'email_address_not_provided',
      'provider_email_needs_verification',
      'Unverified email with github. A confirmation email has been sent',
    ]
    for (const message of cases) {
      expect(mapSupabaseOAuthError(new Error(message))).toContain('GitHub Settings')
    }
  })

  it('maps OAuth callback errors and falls back to OTP copy', () => {
    expect(
      mapAuthCallbackError(new Error('Error getting user email from external provider')),
    ).toContain('GitHub Settings')
    expect(mapAuthCallbackError(new Error('otp_expired'))).toContain('sign-in or reset link')
    expect(isAuthCallbackOAuthError(new Error('Signups not allowed for this instance'))).toBe(
      true,
    )
    expect(isAuthCallbackOAuthError(new Error('otp_expired'))).toBe(false)
  })

  it('uses sign-in or reset wording for OTP errors', () => {
    expect(mapSupabaseOtpError(new Error('otp_expired'))).toContain('sign-in or reset link')
    expect(mapSupabaseOtpError(new Error('invalid token'))).toContain(
      'invalid or has already been used',
    )
  })

  it('exports enumeration-safe reset password success copy', () => {
    expect(RESET_PASSWORD_SUCCESS_COPY).toContain('reset link')
    expect(RESET_PASSWORD_SUCCESS_COPY).toContain('Google or GitHub')
  })
})
