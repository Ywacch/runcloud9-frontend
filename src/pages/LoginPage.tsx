import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C9Card, C9PrimaryButton, C9SectionTitle } from '../ui/c9Primitives'

export default function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  const onPasswordSignIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!normalizedEmail) {
      setError('Enter your invited email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (signInError) throw signInError
      setSuccess('Signed in. Redirecting to your canvas...')
      window.location.assign('/canvas')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (session) {
    return (
      <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--c9-text)]">You are signed in</h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Continue to the canvas to design and deploy your architecture.
          </p>
          <Link
            to="/canvas"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            Go to Canvas
          </Link>
        </C9Card>
      </main>
    )
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <form
        onSubmit={onPasswordSignIn}
        className="w-full max-w-md"
      >
        <C9Card className="p-6">
          <C9SectionTitle
            title="Sign in to RunCloud9 Alpha"
            description="Access is invite-only. Use the email address that was provisioned in Supabase for alpha testing."
          />

          <label className="mt-5 block text-sm text-[var(--c9-text)]" htmlFor="email">
            Invited email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="c9-input"
            placeholder="you@example.com"
          />
          <label className="mt-4 block text-sm text-[var(--c9-text)]" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="c9-input"
            placeholder="••••••••"
          />

          {error ? <p className="c9-banner-error mt-3">{error}</p> : null}
          {success ? <p className="c9-banner-success mt-3">{success}</p> : null}

          <C9PrimaryButton type="submit" disabled={submitting} className="mt-5">
            {submitting ? 'Signing in…' : 'Sign in with password'}
          </C9PrimaryButton>
          <Link
            to="/reset-password"
            className="mt-3 block text-center text-xs text-[var(--c9-badge-text)] transition-colors duration-200 hover:text-[var(--c9-accent)]"
          >
            Forgot password? Set or reset it
          </Link>
        </C9Card>
      </form>
    </main>
  )
}
