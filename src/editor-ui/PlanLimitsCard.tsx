import type { CurrentUserLimits } from '../lib/api'
import {
  CANCEL_SUBSCRIPTION_LABEL,
  displayPlanTierLabel,
  engineerUpgradeCta,
  formatSessionsLeftThisMonth,
  MANAGE_BILLING_HINT,
  MANAGE_BILLING_HINT_STOP_ONLY,
  STOP_SUBSCRIPTION_LABEL,
} from '../lib/billingCopy'
import type { CheckoutStartedSource } from '../lib/analytics'
import { canvasCapForTier } from '../lib/sumDesignBudget'
import { startEngineerCheckout } from '../lib/stripeCheckout'
import { BILLING_ENABLED } from '../lib/featureFlags'
import { FMT_EMPTY } from '../lib/format'

function sessionLengthDetail(
  limits: CurrentUserLimits | undefined,
): string | undefined {
  const defaultMins = limits?.sessionDefaultMins
  const capMins = limits?.sessionCapMins
  if (defaultMins == null || capMins == null) return undefined
  if (defaultMins === capMins) return undefined
  return `${defaultMins} min default`
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
        <div className="space-y-3 border-t border-[var(--c9-border)] pt-4">
          <p className="text-xs leading-relaxed text-[var(--c9-muted)]">
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

function LimitStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--c9-muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-[1.35rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--c9-text-heading)]">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--c9-muted)]">
          {detail}
        </p>
      ) : null}
    </div>
  )
}

export function PlanLimitsCard({
  effectiveTier,
  isInternal,
  quotaTier,
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
  quotaTier: string | undefined
  limits: CurrentUserLimits | undefined
  sessionsRemainingThisMonth: number | null | undefined
  checkoutBusy: boolean
  checkoutError: string | null
  onUpgrade: () => void
  onStop: () => void
  onCancel: () => void
  billingBusy: boolean
  billingError: string | null
  canCancelAndRefund: boolean
}) {
  const planLabel = displayPlanTierLabel(effectiveTier)
  const isFree = effectiveTier === 'free'
  const showPaidBilling = !isFree && !isInternal
  const upgradeCta = engineerUpgradeCta(BILLING_ENABLED)
  const statusLabel = isFree ? 'Free' : 'Active'
  const statusClass = isFree
    ? 'border border-[var(--c9-border)] text-[var(--c9-muted)]'
    : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'

  const canvasCap = canvasCapForTier(quotaTier)
  const sizingValue = `${canvasCap.cpu} CPU`
  const sizingDetail = `${canvasCap.memory} RAM on canvas`

  const maxSessions = limits?.maxSessionsPerMonth
  const hasSessionCap =
    maxSessions != null && sessionsRemainingThisMonth != null && !isInternal
  const sessionsUsed =
    hasSessionCap ? Math.max(0, maxSessions - sessionsRemainingThisMonth) : 0
  const sessionsValue = hasSessionCap
    ? formatSessionsLeftThisMonth(sessionsRemainingThisMonth, maxSessions)
    : isInternal
      ? 'Unlimited'
      : FMT_EMPTY
  const replicaCap = limits?.maxAppServerReplicas

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]"
      aria-labelledby="c9-plan-card-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--c9-border)] px-5 py-4">
        <div>
          <h2
            id="c9-plan-card-title"
            className="text-lg font-semibold tracking-[-0.02em] text-[var(--c9-text-heading)]"
          >
            {planLabel}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--c9-muted)]">
            Live session limits
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-5 px-5 py-5">
        <dl className="grid gap-5 sm:grid-cols-2">
          <LimitStat
            label="Sessions this month"
            value={sessionsValue}
            detail={
              hasSessionCap
                ? `${sessionsUsed} used · resets monthly`
                : undefined
            }
          />

          <LimitStat
            label="Session length"
            value={
              limits?.sessionCapMins != null
                ? `${limits.sessionCapMins} min`
                : FMT_EMPTY
            }
            detail={sessionLengthDetail(limits)}
          />

          <LimitStat
            label="Canvas sizing cap"
            value={sizingValue}
            detail={sizingDetail}
          />

          <LimitStat
            label="Replica cap"
            value={replicaCap != null ? String(replicaCap) : FMT_EMPTY}
            detail="App server & worker pods"
          />
        </dl>

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
  source: CheckoutStartedSource = 'plan_card',
): void {
  void startEngineerCheckout({ source })
    .catch((err: unknown) => {
      onError(err instanceof Error ? err.message : 'Could not start checkout.')
    })
    .finally(onFinally)
}
