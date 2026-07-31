import { describe, expect, it } from 'vitest'
import {
  mergeAuthCallbackParams,
  parseAuthCallbackHash,
  parseAuthCallbackSearch,
  postAuthRedirectPath,
  resolveTokenHashOtpType,
} from './authCallback'

describe('authCallback', () => {
  it('parses code and token_hash from search', () => {
    const params = parseAuthCallbackSearch(
      new URLSearchParams('code=abc&token_hash=hash123&type=invite'),
    )
    expect(params.code).toBe('abc')
    expect(params.tokenHash).toBe('hash123')
    expect(params.type).toBe('invite')
  })

  it('parses type from hash fragment', () => {
    expect(parseAuthCallbackHash('#type=recovery').type).toBe('recovery')
  })

  it('merges search type with hash fallback', () => {
    const merged = mergeAuthCallbackParams(
      new URLSearchParams('token_hash=xyz'),
      '#type=invite',
    )
    expect(merged.tokenHash).toBe('xyz')
    expect(merged.type).toBe('invite')
  })

  it('resolves invite and recovery otp types', () => {
    expect(resolveTokenHashOtpType('invite')).toBe('invite')
    expect(resolveTokenHashOtpType('recovery')).toBe('recovery')
    expect(resolveTokenHashOtpType('invalid')).toBeNull()
    expect(resolveTokenHashOtpType(null)).toBeNull()
  })

  it('routes invite and recovery to set-password', () => {
    expect(postAuthRedirectPath('invite')).toBe('/set-password')
    expect(postAuthRedirectPath('recovery')).toBe('/set-password')
    expect(postAuthRedirectPath('signup')).toBe('/dashboard')
    expect(postAuthRedirectPath(null)).toBe('/dashboard')
  })
})
