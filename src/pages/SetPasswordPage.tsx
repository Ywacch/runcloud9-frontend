import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 pt-20 text-white">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/70 p-6 text-center">
          <h1 className="text-xl font-semibold">Session not found</h1>
          <p className="mt-2 text-sm text-gray-300">
            Open the invite or password recovery link again, then set your password.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 pt-20 text-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/70 p-6"
      >
        <h1 className="text-xl font-semibold">Set your password</h1>
        <p className="mt-2 text-sm text-gray-300">
          Finish your invite/reset flow by choosing a password for future sign-ins.
        </p>

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
          disabled={submitting || hasSession !== true}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {submitting ? 'Saving password…' : 'Set password'}
        </button>

        <Link
          to="/canvas"
          className="mt-3 block text-center text-xs text-blue-300 hover:text-blue-200"
        >
          Continue to canvas
        </Link>
      </form>
    </main>
  )
}
