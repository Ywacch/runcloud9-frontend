import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function hasRecoveryTypeInHash(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  return params.get('type') === 'recovery'
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(hasRecoveryTypeInHash())

  useEffect(() => {
    const onHash = () => setIsRecoveryFlow(hasRecoveryTypeInHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  const onUpdatePassword = async (e: FormEvent) => {
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
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess('Password updated. You can now sign in with password.')
      setPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 pt-20 text-white">
      <form
        onSubmit={isRecoveryFlow ? onUpdatePassword : onSendReset}
        className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/70 p-6"
      >
        <h1 className="text-xl font-semibold">
          {isRecoveryFlow ? 'Set a new password' : 'Reset your password'}
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          {isRecoveryFlow
            ? 'Choose a strong password for your invited Cloud9 account.'
            : 'We will send a secure reset link to your invited email.'}
        </p>

        {!isRecoveryFlow ? (
          <>
            <label className="mt-5 block text-sm text-gray-200" htmlFor="reset-email">
              Invited email
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none ring-blue-500 placeholder:text-gray-500 focus:ring-2"
              placeholder="you@example.com"
            />
          </>
        ) : (
          <>
            <label className="mt-5 block text-sm text-gray-200" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none ring-blue-500 placeholder:text-gray-500 focus:ring-2"
              placeholder="At least 8 characters"
            />
            <label className="mt-4 block text-sm text-gray-200" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none ring-blue-500 placeholder:text-gray-500 focus:ring-2"
              placeholder="Repeat password"
            />
          </>
        )}

        {error ? (
          <p className="mt-3 rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-md border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {submitting
            ? isRecoveryFlow
              ? 'Updating password…'
              : 'Sending reset link…'
            : isRecoveryFlow
              ? 'Update password'
              : 'Send reset link'}
        </button>

        <Link
          to="/login"
          className="mt-3 block text-center text-xs text-blue-300 hover:text-blue-200"
        >
          Back to sign in
        </Link>
      </form>
    </main>
  )
}
