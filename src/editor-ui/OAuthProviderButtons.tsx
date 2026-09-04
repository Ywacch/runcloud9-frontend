import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mapSupabaseOAuthError } from '../lib/authErrorMessage'
import { primeAuthReturnTo } from '../lib/authReturn'
import {
  OAUTH_PROVIDERS,
  signInWithOAuthProvider,
  type OAuthProvider,
} from '../lib/oauthSignIn'

const providerLabels: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
}

const oauthButtonClass =
  'w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/80 px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-surface)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

export interface OAuthProviderButtonsProps {
  idPrefix?: string
  authReturnPath?: string
  overwriteAuthReturnPath?: boolean
  disabled?: boolean
}

export function OAuthProviderButtons({
  idPrefix = 'oauth',
  authReturnPath = '/dashboard',
  overwriteAuthReturnPath = false,
  disabled = false,
}: OAuthProviderButtonsProps) {
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async (provider: OAuthProvider) => {
    if (disabled || busyProvider) return
    setError(null)
    setBusyProvider(provider)
    primeAuthReturnTo(authReturnPath, { overwrite: overwriteAuthReturnPath })
    try {
      const { error: oauthError } = await signInWithOAuthProvider(provider)
      if (oauthError) {
        setError(mapSupabaseOAuthError(oauthError))
        setBusyProvider(null)
        return
      }
    } catch (err) {
      setError(mapSupabaseOAuthError(err))
      setBusyProvider(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {OAUTH_PROVIDERS.map((provider) => (
        <button
          key={provider}
          id={`${idPrefix}-${provider}`}
          type="button"
          disabled={disabled || busyProvider !== null}
          onClick={() => void handleClick(provider)}
          className={oauthButtonClass}
        >
          {busyProvider === provider ? 'Redirecting…' : providerLabels[provider]}
        </button>
      ))}
      {error ? <p className="c9-banner-error">{error}</p> : null}
      <p className="text-center text-[10px] leading-relaxed text-[var(--c9-muted)]">
        By continuing you agree to our{' '}
        <Link to="/terms" className="text-[var(--c9-accent)] hover:underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="text-[var(--c9-accent)] hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
