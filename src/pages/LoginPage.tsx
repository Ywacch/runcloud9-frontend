import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!normalizedEmail) {
      setError('Enter your invited email address.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSent(false)
    try {
      const redirectTo = `${window.location.origin}/canvas`
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: redirectTo },
      })
      if (signInError) throw signInError
      setSent(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send sign-in link.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 pt-20 text-white">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/70 p-6 text-center">
          <h1 className="text-xl font-semibold">You are signed in</h1>
          <p className="mt-2 text-sm text-gray-300">
            Continue to the canvas to design and deploy your architecture.
          </p>
          <Link
            to="/canvas"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Go to Canvas
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
        <h1 className="text-xl font-semibold">Sign in to Cloud9 Alpha</h1>
        <p className="mt-2 text-sm text-gray-300">
          Access is invite-only. Use the email address that was provisioned in
          Supabase for alpha testing.
        </p>

        <label className="mt-5 block text-sm text-gray-200" htmlFor="email">
          Invited email
        </label>
        <input
          id="email"
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
        {sent ? (
          <p className="mt-3 rounded-md border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
            Check your email for a secure sign-in link.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {submitting ? 'Sending link…' : 'Send magic link'}
        </button>
      </form>
    </main>
  )
}
