import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { mapSupabaseOAuthError } from '../lib/authErrorMessage'
import { trackEvent } from '../lib/analytics'
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
  'flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/80 px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-surface)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 19 19"
      aria-hidden
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844"
      />
    </svg>
  )
}

const providerIcons: Record<OAuthProvider, ComponentType> = {
  google: GoogleIcon,
  github: GitHubIcon,
}

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
    trackEvent('auth_started', { provider })
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
      {OAUTH_PROVIDERS.map((provider) => {
        const Icon = providerIcons[provider]
        return (
          <button
            key={provider}
            id={`${idPrefix}-${provider}`}
            type="button"
            disabled={disabled || busyProvider !== null}
            onClick={() => void handleClick(provider)}
            className={oauthButtonClass}
          >
            {busyProvider === provider ? (
              'Redirecting…'
            ) : (
              <>
                <Icon />
                {providerLabels[provider]}
              </>
            )}
          </button>
        )
      })}
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
