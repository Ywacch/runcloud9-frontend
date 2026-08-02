import { Link } from 'react-router-dom'
import {
  displayPlanTierLabel,
  formatSessionsLeftThisMonth,
} from '../../lib/billingCopy'

/** Compact plan line for Engineer / internal users on the dashboard. */
export function PlanSummaryChip({
  effectiveTier,
  sessionsRemainingThisMonth,
  maxSessionsPerMonth,
}: {
  effectiveTier: string | null | undefined
  sessionsRemainingThisMonth: number | null | undefined
  maxSessionsPerMonth: number | null | undefined
}) {
  const planLabel = displayPlanTierLabel(effectiveTier)
  const sessionsLine =
    maxSessionsPerMonth != null && sessionsRemainingThisMonth != null
      ? formatSessionsLeftThisMonth(
          sessionsRemainingThisMonth,
          maxSessionsPerMonth,
        )
      : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/60 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--c9-text)]">
          {planLabel}
          <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            Active
          </span>
        </p>
        <p className="mt-0.5 text-xs text-[var(--c9-muted)]">
          {sessionsLine
            ? `Sessions this month: ${sessionsLine}`
            : 'Engineer features are active on your account.'}
        </p>
      </div>
      <Link
        to="/profile"
        className="shrink-0 text-sm text-[var(--c9-accent)] transition-colors hover:text-[var(--c9-accent-hover)]"
      >
        Manage plan
      </Link>
    </div>
  )
}
