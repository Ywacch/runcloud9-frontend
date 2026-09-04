import { describe, expect, it } from 'vitest'
import {
  RESET_PASSWORD_SUCCESS_COPY,
  mapSupabaseOtpError,
  mapSupabaseSignInError,
} from './authErrorMessage'

describe('authErrorMessage', () => {
  it('adds OAuth hint for invalid password sign-in', () => {
    const msg = mapSupabaseSignInError(new Error('Invalid login credentials'))
    expect(msg).toContain('Email or password is incorrect.')
    expect(msg).toContain('Google or GitHub')
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
