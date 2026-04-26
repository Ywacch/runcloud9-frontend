import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C9Card, C9PrimaryButton, C9SectionTitle } from '../ui/c9Primitives'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  const onSendReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!normalizedEmail) {
      setError('Enter your invited email address.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      )
      if (resetError) throw resetError
      setSuccess('Check your email for a password reset link.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <form
        onSubmit={onSendReset}
        className="w-full max-w-md"
      >
        <C9Card className="p-6">
          <C9SectionTitle
            title="Reset your password"
            description="We will send a secure reset link to your invited email."
          />

          <label className="mt-5 block text-sm text-[var(--c9-text)]" htmlFor="reset-email">
            Invited email
          </label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="c9-input"
            placeholder="you@example.com"
          />

          {error ? <p className="c9-banner-error mt-3">{error}</p> : null}
          {success ? <p className="c9-banner-success mt-3">{success}</p> : null}

          <C9PrimaryButton type="submit" disabled={submitting} className="mt-5">
            {submitting ? 'Sending reset link…' : 'Send reset link'}
          </C9PrimaryButton>

          <Link
            to="/login"
            className="mt-3 block text-center text-xs text-[var(--c9-badge-text)] transition-colors duration-200 hover:text-[var(--c9-accent)]"
          >
            Back to sign in
          </Link>
        </C9Card>
      </form>
    </main>
  )
}
