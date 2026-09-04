import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { mapSupabaseSignInError } from '../lib/authErrorMessage'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../product/stores/authStore'
import { OAuthProviderButtons } from './OAuthProviderButtons'

const labelClass = 'text-sm font-medium text-[var(--c9-text)]'

const switchLinkClass =
  'text-center text-xs text-[var(--c9-badge-text)] transition-colors duration-200 hover:text-[var(--c9-accent)]'

export interface SignInFormProps {
  idPrefix?: string
  submitLabel?: string
  showForgotPasswordLink?: boolean
  showHelper?: boolean
  authReturnPath?: string
  overwriteAuthReturnPath?: boolean
  passwordFormVisible?: boolean
  onPasswordFormVisibleChange?: (visible: boolean) => void
  onSuccess?: () => void
  onCancel?: () => void
  cancelLabel?: string
}

export function SignInForm({
  idPrefix = 'signin',
  submitLabel = 'Sign in',
  showForgotPasswordLink = true,
  showHelper = true,
  authReturnPath = '/dashboard',
  overwriteAuthReturnPath = false,
  passwordFormVisible = false,
  onPasswordFormVisibleChange,
  onSuccess,
  onCancel,
  cancelLabel = 'Keep designing',
}: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const emailId = `${idPrefix}-email`
  const passwordId = `${idPrefix}-password`

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!normalizedEmail) {
      setError('Enter your email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (signInError) throw signInError
      if (data.session) {
        useAuthStore.getState().setSession(data.session)
      }
      onSuccess?.()
    } catch (err) {
      setError(mapSupabaseSignInError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!passwordFormVisible) {
    return (
      <div className="flex flex-col gap-4">
        <OAuthProviderButtons
          idPrefix={`${idPrefix}-oauth`}
          authReturnPath={authReturnPath}
          overwriteAuthReturnPath={overwriteAuthReturnPath}
          disabled={submitting}
        />
        <button
          type="button"
          id={`${idPrefix}-use-password`}
          disabled={submitting}
          onClick={() => onPasswordFormVisibleChange?.(true)}
          className={switchLinkClass}
        >
          Sign in with password
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/80 px-4 py-2 text-sm font-medium text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-surface)] active:scale-[0.98] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {showHelper ? (
          <p className="text-sm leading-relaxed text-[var(--c9-muted)]">
            Sign in with the email and password for your RunCloud9 account.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor={emailId}>
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            disabled={submitting}
            className="c9-input"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor={passwordId}>
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            disabled={submitting}
            className="c9-input"
            placeholder="Password"
          />
        </div>

        {error ? <p className="c9-banner-error">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-[transform,background-color] duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : submitLabel}
        </button>

        {onCancel ? (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/80 px-4 py-2 text-sm font-medium text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-surface)] active:scale-[0.98] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        ) : null}

        {showForgotPasswordLink ? (
          <Link
            to="/reset-password"
            className={`${switchLinkClass} block`}
          >
            Forgot password? Set or reset it
          </Link>
        ) : null}
      </form>

      <button
        type="button"
        id={`${idPrefix}-use-oauth`}
        disabled={submitting}
        onClick={() => onPasswordFormVisibleChange?.(false)}
        className={switchLinkClass}
      >
        Use Google or GitHub instead
      </button>
    </div>
  )
}
