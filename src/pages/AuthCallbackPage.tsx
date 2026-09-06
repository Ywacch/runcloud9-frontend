import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  mergeAuthCallbackParams,
  parseAuthCallbackOAuthError,
  postAuthRedirectPath,
  resolveTokenHashOtpType,
} from '../lib/authCallback'
import { mapAuthCallbackError, isAuthCallbackOAuthError } from '../lib/authErrorMessage'
import { trackEvent } from '../lib/analytics'
import { categorizeAuthCallbackOAuthRedirect } from '../lib/authAnalytics'
import type { AuthFailedCategory, SafeErrorCategory } from '../lib/analytics'
import { consumeAuthReturnTo } from '../lib/authReturn'
import { supabase } from '../lib/supabase'
import { C9Card, C9SectionTitle } from '../editor-ui/c9Primitives'

type CallbackStatus = 'loading' | 'error'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<CallbackStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [oauthFailure, setOauthFailure] = useState(false)

  useEffect(() => {
    const run = async () => {
      const fail = (
        message: string,
        errorCategory: AuthFailedCategory | SafeErrorCategory,
        isOauth = false,
      ) => {
        setErrorMessage(message)
        setOauthFailure(isOauth)
        setStatus('error')
        trackEvent('auth_failed', { errorCategory })
      }

      const oauthError = parseAuthCallbackOAuthError(searchParams)
      if (oauthError) {
        fail(
          mapAuthCallbackError(new Error(oauthError)),
          categorizeAuthCallbackOAuthRedirect(searchParams),
          true,
        )
        return
      }

      const { code, tokenHash, type } = mergeAuthCallbackParams(
        searchParams,
        window.location.hash,
      )

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          fail(
            mapAuthCallbackError(error),
            'exchange_failed',
            isAuthCallbackOAuthError(error),
          )
          return
        }
        await supabase.auth.refreshSession()
      } else if (tokenHash) {
        const otpType = resolveTokenHashOtpType(type)
        if (!otpType) {
          fail(
            'This sign-in link is missing a valid type. Request a new link from your email.',
            'unauthorized',
          )
          return
        }
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        })
        if (error) {
          fail(mapAuthCallbackError(error), 'unauthorized')
          return
        }
        await supabase.auth.refreshSession()
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        fail(
          'We could not start your session. Open the sign-in or reset link from your email again.',
          'unauthorized',
        )
        return
      }

      const redirectPath = postAuthRedirectPath(type)
      navigate(
        redirectPath === '/set-password'
          ? redirectPath
          : consumeAuthReturnTo(redirectPath),
        { replace: true },
      )
    }
    void run()
  }, [navigate, searchParams])

  if (status === 'error') {
    return (
      <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <C9SectionTitle
            title={oauthFailure ? 'Could not complete sign-in' : 'Link could not be verified'}
            description={errorMessage ?? 'This sign-in or reset link is no longer valid.'}
          />
          <div className="mt-5 flex flex-col gap-2">
            {oauthFailure ? null : (
              <Link
                to="/reset-password"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
              >
                Request a new reset link
              </Link>
            )}
            <Link
              to="/login"
              className={
                oauthFailure
                  ? 'inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]'
                  : 'text-xs text-[var(--c9-badge-text)] transition-colors duration-200 hover:text-[var(--c9-accent)]'
              }
            >
              Back to sign in
            </Link>
          </div>
        </C9Card>
      </main>
    )
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-[var(--c9-muted)]">Completing sign-in…</p>
      </div>
    </main>
  )
}
