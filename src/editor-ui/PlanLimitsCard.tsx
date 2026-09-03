import type { CurrentUserLimits } from '../lib/api'
import {
  CANCEL_SUBSCRIPTION_LABEL,
  displayPlanTierLabel,
  ENGINEER_BENEFIT_ROWS,
  engineerBenefitIncluded,
  engineerUpgradeCta,
  formatSessionsLeftThisMonth,
  MANAGE_BILLING_HINT,
  MANAGE_BILLING_HINT_STOP_ONLY,
  STOP_SUBSCRIPTION_LABEL,
} from '../lib/billingCopy'
import { startEngineerCheckout } from '../lib/stripeCheckout'
import { BILLING_ENABLED } from '../lib/featureFlags'

function PlanMark({ included }: { included: boolean }) {
  if (!included) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c9-muted)]"
        aria-hidden
      >
        <circle
          cx="8"
          cy="8"
          r="5.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" fill="rgb(16 185 129 / 0.18)" />
      <path
        d="M4.6 8.2 7 10.6 11.5 5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlanBenefitMarks({
  limits,
  isFree,
  className,
}: {
  limits: CurrentUserLimits | undefined
  isFree: boolean
  className?: string
}) {
  return (
    <ul className={className}>
      {ENGINEER_BENEFIT_ROWS.map((row) => {
        const included = engineerBenefitIncluded(row.id, limits)
        return (
          <li key={row.id} className="flex items-start gap-2.5 text-sm">
            <PlanMark included={included} />
            <span
              className={
                included ? 'text-[var(--c9-text)]' : 'text-[var(--c9-muted)]'
              }
            >
              {row.label}
              {isFree && row.explorerNote ? (
                <span className="mt-0.5 block text-xs text-[var(--c9-muted)]">
                  {row.explorerNote}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function PlanBillingActions({
  isFree,
  showPaidBilling,
  upgradeCta,
  checkoutBusy,
  checkoutError,
  onUpgrade,
  onStop,
  onCancel,
  billingBusy,
  billingError,
  canCancelAndRefund,
}: {
  isFree: boolean
  showPaidBilling: boolean
  upgradeCta: { label: string } | null
  checkoutBusy: boolean
  checkoutError: string | null
  onUpgrade: () => void
  onStop: () => void
  onCancel: () => void
  billingBusy: boolean
  billingError: string | null
  canCancelAndRefund: boolean
}) {
  return (
    <>
      {isFree && upgradeCta ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={onUpgrade}
            className="w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkoutBusy ? 'Starting checkout…' : upgradeCta.label}
          </button>
          {checkoutError ? (
            <p className="text-xs text-red-400" role="alert">
              {checkoutError}
            </p>
          ) : null}
        </div>
      ) : null}
      {showPaidBilling && BILLING_ENABLED ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--c9-muted)]">
            {canCancelAndRefund
              ? MANAGE_BILLING_HINT
              : MANAGE_BILLING_HINT_STOP_ONLY}
          </p>
          <button
            type="button"
            disabled={billingBusy}
            onClick={onStop}
            className="w-full rounded-lg border border-[var(--c9-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] hover:text-[var(--c9-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {billingBusy ? 'Opening portal…' : STOP_SUBSCRIPTION_LABEL}
          </button>
          {canCancelAndRefund ? (
            <button
              type="button"
              disabled={billingBusy}
              onClick={onCancel}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billingBusy ? 'Working…' : CANCEL_SUBSCRIPTION_LABEL}
            </button>
          ) : null}
          {billingError ? (
            <p className="text-xs text-red-400" role="alert">
              {billingError}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export function PlanLimitsCard({
  effectiveTier,
  isInternal,
  limits,
  sessionsRemainingThisMonth,
  checkoutBusy,
  checkoutError,
  onUpgrade,
  onStop,
  onCancel,
  billingBusy,
  billingError,
  canCancelAndRefund,
}: {
  effectiveTier: string | null | undefined
  isInternal: boolean
  limits: CurrentUserLimits | undefined
  sessionsRemainingThisMonth: number | null | undefined
  checkoutBusy: boolean
  checkoutError: string | null
  onUpgrade: () => void
  onStop: () => void
  onCancel: () => void
  billingBusy: boolean
  billingError: string | null
  /** When false, Cancel & refund is hidden (used this Stripe billing period). */
  canCancelAndRefund: boolean
}) {
  const planLabel = displayPlanTierLabel(effectiveTier)
  const isFree = effectiveTier === 'free'
  const showPaidBilling = !isFree && !isInternal
  const upgradeCta = engineerUpgradeCta(BILLING_ENABLED)
  const statusLabel = isFree ? 'Free' : 'Active'
  const statusClass = isFree
    ? 'bg-zinc-700/50 text-[var(--c9-muted)]'
    : 'bg-emerald-500/15 text-emerald-300'
  const quotaRows = [
    {
      label: 'Session default',
      value: `${limits?.sessionDefaultMins ?? '—'} min`,
    },
    {
      label: 'Session cap',
      value: `${limits?.sessionCapMins ?? '—'} min`,
    },
    {
      label: 'Max concurrent deployments',
      value: String(limits?.maxConcurrent ?? '—'),
    },
    ...(limits?.maxSessionsPerMonth != null &&
    sessionsRemainingThisMonth != null
      ? [
          {
            label: 'Sessions this month',
            value: formatSessionsLeftThisMonth(
              sessionsRemainingThisMonth,
              limits.maxSessionsPerMonth,
            ),
          },
        ]
      : []),
    {
      label: 'Max app-server & worker replicas',
      value: String(limits?.maxAppServerReplicas ?? '—'),
    },
  ]

  return (
    <section
      className="c9-plan-card overflow-hidden rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 shadow-xl shadow-black/20"
      aria-labelledby="c9-plan-card-title"
    >
      <div className="border-b border-[var(--c9-border)] bg-[var(--c9-bg)]/35 px-[1.2rem] pt-[1.15rem] pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2
            id="c9-plan-card-title"
            className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--c9-text-heading)]"
          >
            {planLabel}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[var(--c9-muted)]">
          {isFree
            ? 'Your current limits and which features are included.'
            : 'Plan limits are active on your account.'}
        </p>
      </div>
      <div className="flex flex-col gap-[1.35rem] px-[1.2rem] pt-[1.15rem] pb-5">
        <div className="flex flex-wrap gap-x-7 gap-y-[1.35rem]">
          <dl className="min-w-[13.5rem] flex-[0.48_1_13.5rem]">
            {quotaRows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 border-b border-[var(--c9-border)] py-[0.7rem] last:border-0"
              >
                <dt className="text-sm text-[var(--c9-muted)]">{row.label}</dt>
                <dd className="text-right text-sm font-medium tabular-nums text-[var(--c9-text)]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="min-w-[16rem] flex-[0.52_1_16rem]">
            {isFree ? (
              <p className="mb-2.5 text-sm text-[var(--c9-muted)]">
                Plan features
              </p>
            ) : null}
            <PlanBenefitMarks
              limits={limits}
              isFree={isFree}
              className="space-y-2.5"
            />
          </div>
        </div>
        <PlanBillingActions
          isFree={isFree}
          showPaidBilling={showPaidBilling}
          upgradeCta={upgradeCta}
          checkoutBusy={checkoutBusy}
          checkoutError={checkoutError}
          onUpgrade={onUpgrade}
          onStop={onStop}
          onCancel={onCancel}
          billingBusy={billingBusy}
          billingError={billingError}
          canCancelAndRefund={canCancelAndRefund}
        />
      </div>
    </section>
  )
}

export function startEngineerUpgrade(
  onError: (message: string) => void,
  onFinally: () => void,
): void {
  void startEngineerCheckout()
    .catch((err: unknown) => {
      onError(err instanceof Error ? err.message : 'Could not start checkout.')
    })
    .finally(onFinally)
}
