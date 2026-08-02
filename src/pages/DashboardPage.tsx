import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { C9Card } from '../editor-ui/c9Primitives'
import { PastRunsSection } from '../editor-ui/PastRunsSection'
import { Footer } from '../components/landing/Footer'
import {
  displayPlanTierLabel,
  formatSessionsLeftThisMonth,
} from '../lib/stripeCheckout'
import { loginPathWithReturnTo } from '../lib/authReturn'

export default function DashboardPage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!session) {
    return (
      <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            Sign in to view your dashboard
          </h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Past runs and session history are available after signing in.
          </p>
          <Link
            to={loginPathWithReturnTo('/dashboard')}
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
          >
            Sign in
          </Link>
        </C9Card>
      </main>
    )
  }

  const limits = currentUser?.limits
  const planLabel = displayPlanTierLabel(currentUser?.effectiveTier)
  const sessionsLine =
    limits?.maxSessionsPerMonth != null &&
    currentUser?.sessionsRemainingThisMonth != null
      ? formatSessionsLeftThisMonth(
          currentUser.sessionsRemainingThisMonth,
          limits.maxSessionsPerMonth,
        )
      : null

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--c9-bg)]">
      <main className="flex-1 px-6 pt-24 pb-16">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--c9-text)]">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-[var(--c9-muted)]">
                {currentUser
                  ? `Signed in on ${planLabel}${sessionsLine ? ` · ${sessionsLine}` : ''}`
                  : 'Loading account…'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/canvas"
                className="rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
              >
                Open canvas
              </Link>
              <Link
                to="/profile"
                className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-2 text-sm text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
              >
                Profile
              </Link>
            </div>
          </div>

          <PastRunsSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
