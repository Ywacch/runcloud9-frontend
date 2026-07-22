import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { refreshCurrentUser } from '../lib/auth'
import { C9Card } from '../editor-ui/c9Primitives'
import { useAuthStore } from '../product/stores/authStore'
import { displayPlanTierLabel } from '../lib/billingCopy'

export default function BillingSuccessPage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const [refreshing, setRefreshing] = useState(true)

  useEffect(() => {
    if (!session) {
      setRefreshing(false)
      return
    }
    setRefreshing(true)
    void refreshCurrentUser()
      .catch(() => {
        /* keep prior tier; webhook may still be catching up */
      })
      .finally(() => setRefreshing(false))
  }, [session])

  const plan = displayPlanTierLabel(currentUser?.effectiveTier)

  return (
    <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <C9Card className="w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
          Payment received
        </h1>
        <p className="mt-2 text-sm text-[var(--c9-muted)]">
          {refreshing
            ? 'Refreshing your plan…'
            : session
              ? `You are on ${plan}. Stripe may take a few seconds to finish activating Engineer.`
              : 'Sign in to confirm your Engineer plan.'}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/canvas"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
          >
            Open canvas
          </Link>
          <Link
            to="/profile"
            className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--c9-border)] px-4 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors hover:bg-[var(--c9-badge-bg)]"
          >
            View profile
          </Link>
          {!session ? (
            <Link
              to="/login"
              className="text-sm text-[var(--c9-accent)] hover:underline"
            >
              Sign in
            </Link>
          ) : null}
        </div>
      </C9Card>
    </main>
  )
}
