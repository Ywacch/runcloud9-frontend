import { Link } from 'react-router-dom'
import {
  displayPlanTierLabel,
  formatSessionsLeftThisMonth,
} from '../../lib/billingCopy'

/** Compact plan status strip for the dashboard (both Explorer and Engineer). */
export function DashboardStatusStrip({
  effectiveTier,
  sessionsRemainingThisMonth,
  maxSessionsPerMonth,
  loading = false,
  loadFailed = false,
  onRetry,
}: {
  effectiveTier: string | null | undefined
  sessionsRemainingThisMonth: number | null | undefined
  maxSessionsPerMonth: number | null | undefined
  loading?: boolean
  loadFailed?: boolean
  onRetry?: () => void
}) {
  const hasUser = effectiveTier != null && effectiveTier !== ''
  const isFree = !hasUser || effectiveTier === 'free'
  const planLabel = displayPlanTierLabel(effectiveTier)
  const sessionsLine =
    maxSessionsPerMonth != null && sessionsRemainingThisMonth != null
      ? formatSessionsLeftThisMonth(
          sessionsRemainingThisMonth,
          maxSessionsPerMonth,
        )
      : null

  let description: string
  if (loading) {
    description = 'Loading plan…'
  } else if (loadFailed) {
    description = 'Could not load plan details.'
  } else if (isFree) {
    description = sessionsLine
      ? `Sessions this month: ${sessionsLine}`
      : 'Free tier · compare plans to unlock the full lab.'
  } else {
    description = sessionsLine
      ? `Sessions this month: ${sessionsLine}`
      : 'Engineer features are active on your account.'
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--c9-text)]">
          {loading ? 'Plan' : planLabel}
          {!loading && !loadFailed ? (
            isFree ? (
              <span className="ml-2 rounded-full bg-[var(--c9-bg-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--c9-muted)]">
                Free
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                Active
              </span>
            )
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-[var(--c9-muted)]">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {(loading || loadFailed) && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="text-sm text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)] disabled:opacity-50"
          >
            Retry
          </button>
        ) : null}
        <Link
          to={isFree ? '/pricing' : '/profile'}
          className="text-sm text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg-card)]"
        >
          {isFree ? 'Compare plans →' : 'Manage plan →'}
        </Link>
      </div>
    </div>
  )
}
