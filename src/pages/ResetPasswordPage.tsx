import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 pt-20 text-white">
      <form
        onSubmit={onSendReset}
        className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/70 p-6"
      >
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-gray-300">
          We will send a secure reset link to your invited email.
        </p>

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
          {submitting ? 'Sending reset link…' : 'Send reset link'}
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
