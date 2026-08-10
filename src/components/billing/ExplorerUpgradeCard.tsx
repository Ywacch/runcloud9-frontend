import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { CurrentUserLimits } from '../../lib/api'
import {
  ENGINEER_BENEFIT_ROWS,
  engineerUpgradeCta,
  formatSessionsLeftThisMonth,
  FREE_TIER_LABEL,
} from '../../lib/billingCopy'
import { BILLING_ENABLED } from '../../lib/featureFlags'
import { startEngineerUpgrade } from '../../editor-ui/PlanLimitsCard'
import { C9Card } from '../../editor-ui/c9Primitives'

const DASHBOARD_BENEFIT_IDS = [
  'load_balancer',
  'mq_worker',
  'proxy_cache',
  'higher_quotas',
  'all_templates',
] as const

/** Proactive Explorer missing-out card for the dashboard. */
export function ExplorerUpgradeCard({
  limits,
  sessionsRemainingThisMonth,
}: {
  limits: CurrentUserLimits | undefined
  sessionsRemainingThisMonth: number | null | undefined
}) {
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const upgradeCta = engineerUpgradeCta(BILLING_ENABLED)

  const sessionsLine =
    limits?.maxSessionsPerMonth != null && sessionsRemainingThisMonth != null
      ? formatSessionsLeftThisMonth(
          sessionsRemainingThisMonth,
          limits.maxSessionsPerMonth,
        )
      : null

  const rows = ENGINEER_BENEFIT_ROWS.filter((row) =>
    (DASHBOARD_BENEFIT_IDS as readonly string[]).includes(row.id),
  )

  return (
    <C9Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--c9-border)] bg-[var(--c9-surface)]/80 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
              Your plan
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--c9-text)]">
              {FREE_TIER_LABEL}
            </p>
            <p className="mt-1 text-sm text-[var(--c9-muted)]">
              {sessionsLine
                ? `Sessions this month: ${sessionsLine}`
                : 'Free tier · upgrade to unlock the full lab'}
            </p>
          </div>
          <span className="rounded-full bg-zinc-700/50 px-3 py-1 text-xs font-medium text-[var(--c9-muted)]">
            Free
          </span>
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
          Unlock on Engineer
        </p>
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-2 text-sm text-[var(--c9-muted)]"
            >
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-700/60 text-[10px] font-bold"
                aria-hidden
              >
                ·
              </span>
              <span>
                <span className="text-[var(--c9-text)]">{row.label}</span>
                {row.explorerNote ? (
                  <span className="mt-0.5 block text-xs text-[var(--c9-muted)]">
                    {row.explorerNote}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/pricing"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-[var(--c9-border)] px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] hover:text-[var(--c9-accent)]"
          >
            Compare plans
          </Link>
          {upgradeCta ? (
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={() => {
                setCheckoutError(null)
                setCheckoutBusy(true)
                startEngineerUpgrade(setCheckoutError, () =>
                  setCheckoutBusy(false),
                )
              }}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkoutBusy ? 'Starting checkout…' : upgradeCta.label}
            </button>
          ) : (
            <Link
              to="/profile"
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
            >
              View plan
            </Link>
          )}
        </div>
        {checkoutError ? (
          <p className="mt-2 text-xs text-red-400" role="alert">
            {checkoutError}
          </p>
        ) : null}
      </div>
    </C9Card>
  )
}
