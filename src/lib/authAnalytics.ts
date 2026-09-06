import type { User } from '@supabase/supabase-js'
import type {
  AuthFailedCategory,
  OAuthAnalyticsProvider,
  SafeErrorCategory,
} from './analytics'
import { parseAuthCallbackOAuthError } from './authCallback'

function signupsDisabledMessage(raw: string): boolean {
  const msg = raw.toLowerCase()
  return (
    msg.includes('signups not allowed') ||
    msg.includes('signup_disabled') ||
    msg.includes('signups disabled')
  )
}

/** Map OAuth redirect query failures to allowlisted analytics categories. */
export function categorizeAuthCallbackOAuthRedirect(
  search: URLSearchParams,
): AuthFailedCategory | SafeErrorCategory {
  if (search.get('error') === 'access_denied') return 'oauth_denied'
  const description = parseAuthCallbackOAuthError(search) ?? ''
  if (signupsDisabledMessage(description)) return 'signups_disabled'
  return 'unauthorized'
}

export function oauthAnalyticsProvider(
  provider: unknown,
): OAuthAnalyticsProvider | undefined {
  if (provider === 'google' || provider === 'github') return provider
  return undefined
}

export function isNewOAuthUser(
  user: Pick<User, 'created_at' | 'last_sign_in_at'>,
): boolean {
  const created = user.created_at
  const lastSignIn = user.last_sign_in_at
  if (!created || !lastSignIn) return false
  const createdMs = Date.parse(created)
  const lastMs = Date.parse(lastSignIn)
  if (!Number.isFinite(createdMs) || !Number.isFinite(lastMs)) return false
  return Math.abs(lastMs - createdMs) <= 10_000
}
