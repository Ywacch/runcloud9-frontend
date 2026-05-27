import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C9Card, C9PrimaryButton, C9SectionTitle } from '../editor-ui/c9Primitives'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      setHasSession(Boolean(data.session))
    }
    void run()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError('Enter a new password.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      })
      if (updateError) throw updateError
      setSuccess('Password set successfully. You can continue to the canvas.')
      setPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (hasSession === false) {
    return (
      <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--c9-text)]">Session not found</h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Open the invite or password recovery link again, then set your password.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            Back to sign in
          </Link>
        </C9Card>
      </main>
    )
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md"
      >
        <C9Card className="p-6">
          <C9SectionTitle
            title="Set your password"
            description="Finish your invite/reset flow by choosing a password for future sign-ins."
          />

          <label className="mt-5 block text-sm text-[var(--c9-text)]" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="c9-input"
            placeholder="At least 8 characters"
          />

          <label className="mt-4 block text-sm text-[var(--c9-text)]" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="c9-input"
            placeholder="Repeat password"
          />

          {error ? <p className="c9-banner-error mt-3">{error}</p> : null}
          {success ? <p className="c9-banner-success mt-3">{success}</p> : null}

          <C9PrimaryButton
            type="submit"
            disabled={submitting || hasSession !== true}
            className="mt-5"
          >
            {submitting ? 'Saving password…' : 'Set password'}
          </C9PrimaryButton>

          <Link
            to="/canvas"
            className="mt-3 block text-center text-xs text-[var(--c9-badge-text)] transition-colors duration-200 hover:text-[var(--c9-accent)]"
          >
            Continue to canvas
          </Link>
        </C9Card>
      </form>
    </main>
  )
}
