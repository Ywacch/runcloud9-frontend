import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { C9Card } from '../editor-ui/c9Primitives'
import { PastRunsSection } from '../editor-ui/PastRunsSection'
import { Footer } from '../components/landing/Footer'
import { DashboardHero } from '../components/dashboard/DashboardHero'
import { DashboardStatusStrip } from '../components/dashboard/DashboardStatusStrip'
import { loginPathWithReturnTo } from '../lib/authReturn'
import { refreshCurrentUser } from '../lib/auth'
import { hasDevAccountAccess } from '../lib/devAccountPreview'

export default function DashboardPage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const [planLoading, setPlanLoading] = useState(() => !currentUser)

  useEffect(() => {
    if (!hasDevAccountAccess(session)) return
    if (currentUser) {
      setPlanLoading(false)
      return
    }
    let cancelled = false
    setPlanLoading(true)
    void refreshCurrentUser().finally(() => {
      if (!cancelled) setPlanLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [session, currentUser])

  if (!hasDevAccountAccess(session)) {
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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--c9-bg)]">
      <main className="flex-1 px-6 pt-24 pb-12">
        <div className="mx-auto max-w-[1200px] space-y-5">
          <DashboardHero />

          <DashboardStatusStrip
            effectiveTier={currentUser?.effectiveTier}
            sessionsRemainingThisMonth={
              currentUser?.sessionsRemainingThisMonth
            }
            maxSessionsPerMonth={
              currentUser?.limits?.maxSessionsPerMonth ?? null
            }
            loading={planLoading}
            loadFailed={!planLoading && !currentUser}
            onRetry={() => {
              setPlanLoading(true)
              void refreshCurrentUser().finally(() => setPlanLoading(false))
            }}
          />

          <PastRunsSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
