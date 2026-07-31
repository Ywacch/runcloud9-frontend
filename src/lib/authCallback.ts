import type { EmailOtpType } from '@supabase/supabase-js'

const TOKEN_HASH_OTP_TYPES = new Set<EmailOtpType>([
  'invite',
  'recovery',
  'signup',
  'email',
  'email_change',
  'magiclink',
])

export interface AuthCallbackParams {
  code: string | null
  tokenHash: string | null
  type: string | null
}

export function parseAuthCallbackSearch(search: URLSearchParams): AuthCallbackParams {
  return {
    code: search.get('code'),
    tokenHash: search.get('token_hash'),
    type: search.get('type'),
  }
}

export function parseAuthCallbackHash(hash: string): Pick<AuthCallbackParams, 'type'> {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { type: null }
  return { type: new URLSearchParams(raw).get('type') }
}

/** Resolve Supabase EmailOtpType for token_hash verification. */
export function resolveTokenHashOtpType(type: string | null | undefined): EmailOtpType | null {
  if (!type) return null
  return TOKEN_HASH_OTP_TYPES.has(type as EmailOtpType) ? (type as EmailOtpType) : null
}

export function postAuthRedirectPath(
  type: string | null | undefined,
): '/set-password' | '/dashboard' {
  if (type === 'recovery' || type === 'invite') return '/set-password'
  return '/dashboard'
}

export function mergeAuthCallbackParams(
  search: URLSearchParams,
  hash: string,
): AuthCallbackParams {
  const fromSearch = parseAuthCallbackSearch(search)
  const fromHash = parseAuthCallbackHash(hash)
  return {
    code: fromSearch.code,
    tokenHash: fromSearch.tokenHash,
    type: fromSearch.type ?? fromHash.type,
  }
}
