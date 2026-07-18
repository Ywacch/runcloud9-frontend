import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { trackEvent } from '../lib/analytics'
import { C9Card } from '../editor-ui/c9Primitives'
import { SignInForm } from '../editor-ui/SignInForm'

export default function LoginPage() {
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    if (session) return
    trackEvent('login_viewed', {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (session) {
    return (
      <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            You are signed in
          </h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Continue to the canvas to design and deploy your architecture.
          </p>
          <Link
            to="/canvas"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
          >
            Go to Canvas
          </Link>
        </C9Card>
      </main>
    )
  }

  return (
    <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <div className="w-full max-w-md">
        <C9Card className="p-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            Sign in to RunCloud9 Alpha
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--c9-muted)]">
            Access is invite-only. Use the email address provisioned in Supabase for alpha
            testing.
          </p>
          <div className="mt-5">
            <SignInForm
              idPrefix="login-page"
              submitLabel="Sign in with password"
              showHelper={false}
              onSuccess={() => {
                window.location.assign('/canvas')
              }}
            />
          </div>
        </C9Card>
      </div>
    </main>
  )
}
