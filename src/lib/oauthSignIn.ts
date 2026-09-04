import type { Provider } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type OAuthProvider = Extract<Provider, 'google' | 'github'>

export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'github']

export function authCallbackRedirectUrl(origin = window.location.origin): string {
  return `${origin}/auth/callback`
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider,
  origin = window.location.origin,
) {
  const redirectTo = authCallbackRedirectUrl(origin)
  const options =
    provider === 'github'
      ? { redirectTo, scopes: 'user:email' }
      : { redirectTo }

  return supabase.auth.signInWithOAuth({ provider, options })
}
