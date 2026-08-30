import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { trackEvent } from '../lib/analytics'
import { consumeAuthReturnTo, setAuthReturnTo } from '../lib/authReturn'
import { C9Card } from '../editor-ui/c9Primitives'
import { SignInForm } from '../editor-ui/SignInForm'

export default function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (session) return
    trackEvent('login_viewed', {})
    const returnTo = searchParams.get('returnTo')
    if (returnTo) setAuthReturnTo(returnTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (session) {
    return <Navigate to={consumeAuthReturnTo('/dashboard')} replace />
  }

  return (
    <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <div className="w-full max-w-md">
        <C9Card className="p-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            Sign in to RunCloud9
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--c9-muted)]">
            Use the email and password for your account, or sign in with Google or GitHub if you
            connected them.
          </p>
          <div className="mt-5">
            <SignInForm
              idPrefix="login-page"
              submitLabel="Sign in with password"
              showHelper={false}
              onSuccess={() => {
                navigate(consumeAuthReturnTo('/dashboard'), { replace: true })
              }}
            />
          </div>
        </C9Card>
      </div>
    </main>
  )
}
