import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { C9Card } from '../editor-ui/c9Primitives'
import {
  displayPlanTierLabel,
  formatSessionsLeftThisMonth,
  startEngineerCheckout,
  UPGRADE_TO_ENGINEER_LABEL,
} from '../lib/stripeCheckout'
import { loginPathWithReturnTo } from '../lib/authReturn'

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--c9-border)] py-2 last:border-0">
      <span className="text-sm text-[var(--c9-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--c9-text)]">{value}</span>
    </div>
  )
}

function BoolLimit({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--c9-border)] py-2 last:border-0">
      <span className="text-sm text-[var(--c9-muted)]">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          allowed
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-zinc-700/50 text-[var(--c9-muted)]'
        }`}
      >
        {allowed ? 'Enabled' : 'Not included'}
      </span>
    </div>
  )
}

export default function ProfilePage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)

  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  if (!session) {
    return (
      <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            Sign in to view your profile
          </h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Your plan and limits are available after signing in.
          </p>
          <Link
            to={loginPathWithReturnTo('/profile')}
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
          >
            Sign in
          </Link>
        </C9Card>
      </main>
    )
  }

  const limits = currentUser?.limits
  const isFree = currentUser?.effectiveTier === 'free'
  const planLabel = displayPlanTierLabel(currentUser?.effectiveTier)

  const handleUpgrade = () => {
    setCheckoutError(null)
    setCheckoutBusy(true)
    void startEngineerCheckout()
      .catch((err: unknown) => {
        setCheckoutError(
          err instanceof Error ? err.message : 'Could not start checkout.',
        )
      })
      .finally(() => setCheckoutBusy(false))
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--c9-bg)] px-6 pt-24 pb-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--c9-text)]">
            Profile
          </h1>
          <Link
            to="/dashboard"
            className="text-sm text-[var(--c9-accent)] transition-colors hover:text-[var(--c9-accent-hover)]"
          >
            View past runs
          </Link>
        </div>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
            Plan and limits
          </h2>
          <C9Card className="p-4">
            {!currentUser ? (
              <p className="text-sm text-[var(--c9-muted)]">Loading plan info…</p>
            ) : (
              <div>
                <LimitRow label="Plan tier" value={planLabel} />
                {!isFree ? (
                  <p className="py-2 text-sm text-[var(--c9-muted)]">
                    You&apos;re on Engineer.
                  </p>
                ) : (
                  <div className="space-y-2 py-3">
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={handleUpgrade}
                      className="w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkoutBusy ? 'Starting checkout…' : UPGRADE_TO_ENGINEER_LABEL}
                    </button>
                    {checkoutError ? (
                      <p className="text-xs text-red-400" role="alert">
                        {checkoutError}
                      </p>
                    ) : null}
                  </div>
                )}
                <LimitRow
                  label="Session default"
                  value={`${limits?.sessionDefaultMins ?? '—'} min`}
                />
                <LimitRow
                  label="Session cap"
                  value={`${limits?.sessionCapMins ?? '—'} min`}
                />
                <LimitRow
                  label="Max concurrent deployments"
                  value={String(limits?.maxConcurrent ?? '—')}
                />
                {limits?.maxSessionsPerMonth != null &&
                currentUser.sessionsRemainingThisMonth != null ? (
                  <LimitRow
                    label="Sessions this month"
                    value={formatSessionsLeftThisMonth(
                      currentUser.sessionsRemainingThisMonth,
                      limits.maxSessionsPerMonth,
                    )}
                  />
                ) : null}
                <LimitRow
                  label="Max app-server replicas"
                  value={String(limits?.maxAppServerReplicas ?? '—')}
                />
                <BoolLimit
                  label="Load balancer"
                  allowed={limits?.allowLoadBalancer ?? false}
                />
                <BoolLimit
                  label="MQ worker"
                  allowed={limits?.allowMQWorker ?? false}
                />
                <BoolLimit
                  label="Proxy cache"
                  allowed={limits?.allowProxyCache ?? false}
                />
                <BoolLimit
                  label="All templates"
                  allowed={limits?.allTemplates ?? false}
                />
              </div>
            )}
          </C9Card>
        </section>
      </div>
    </main>
  )
}
