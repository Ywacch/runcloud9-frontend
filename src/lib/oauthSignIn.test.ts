import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authCallbackRedirectUrl, signInWithOAuthProvider } from './oauthSignIn'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ data: { provider: 'google', url: 'https://example.com' }, error: null }),
    },
  },
}))

describe('oauthSignIn', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signInWithOAuth).mockClear()
  })

  it('builds the auth callback redirect URL', () => {
    expect(authCallbackRedirectUrl('https://app.runcloud9.com')).toBe(
      'https://app.runcloud9.com/auth/callback',
    )
  })

  it('starts Google OAuth with PKCE redirect', async () => {
    await signInWithOAuthProvider('google', 'https://app.runcloud9.com')

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.runcloud9.com/auth/callback' },
    })
  })

  it('starts GitHub OAuth with user:email scope', async () => {
    await signInWithOAuthProvider('github', 'https://app.runcloud9.com')

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: 'https://app.runcloud9.com/auth/callback',
        scopes: 'user:email',
      },
    })
  })
})
