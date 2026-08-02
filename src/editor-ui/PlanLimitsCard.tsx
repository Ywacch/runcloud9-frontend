import type { CurrentUserLimits } from '../lib/api'
import {
  CANCEL_SUBSCRIPTION_LABEL,
  displayPlanTierLabel,
  ENGINEER_BENEFIT_ROWS,
  engineerBenefitIncluded,
  formatSessionsLeftThisMonth,
  MANAGE_BILLING_HINT,
  MANAGE_BILLING_HINT_STOP_ONLY,
  STOP_SUBSCRIPTION_LABEL,
  UPGRADE_TO_ENGINEER_LABEL,
} from '../lib/billingCopy'
import { startEngineerCheckout } from '../lib/stripeCheckout'
import { C9Card } from './c9Primitives'

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--c9-border)] py-2.5 last:border-0">
      <span className="text-sm text-[var(--c9-muted)]">{label}</span>
      <span className="text-right text-sm font-medium text-[var(--c9-text)]">{value}</span>
    </div>
  )
}

function BenefitChecklist({
  limits,
  isFree,
}: {
  limits: CurrentUserLimits | undefined
  isFree: boolean
}) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        {isFree ? 'Unlock on Engineer' : 'Included on Engineer'}
      </p>
      <ul className="mt-2 space-y-2">
        {ENGINEER_BENEFIT_ROWS.map((row) => {
          const included = engineerBenefitIncluded(row.id, limits)
          return (
            <li key={row.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  included
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-zinc-700/60 text-[var(--c9-muted)]'
                }`}
                aria-hidden
              >
                {included ? '✓' : '·'}
              </span>
              <span className={included ? 'text-[var(--c9-text)]' : 'text-[var(--c9-muted)]'}>
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
    </div>
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

  return (
    <C9Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--c9-border)] bg-[var(--c9-surface)]/80 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
              Current plan
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--c9-text)]">{planLabel}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isFree
                ? 'bg-zinc-700/50 text-[var(--c9-muted)]'
                : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {isFree ? 'Free tier' : 'Active'}
          </span>
        </div>
        {!isFree ? (
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Engineer features are active on your account.
          </p>
        ) : null}
      </div>

      <div className="space-y-1 px-4 py-3">
        <LimitRow label="Session default" value={`${limits?.sessionDefaultMins ?? '—'} min`} />
        <LimitRow label="Session cap" value={`${limits?.sessionCapMins ?? '—'} min`} />
        <LimitRow
          label="Max concurrent deployments"
          value={String(limits?.maxConcurrent ?? '—')}
        />
        {limits?.maxSessionsPerMonth != null && sessionsRemainingThisMonth != null ? (
          <LimitRow
            label="Sessions this month"
            value={formatSessionsLeftThisMonth(
              sessionsRemainingThisMonth,
              limits.maxSessionsPerMonth,
            )}
          />
        ) : null}
        <LimitRow
          label="Max app-server replicas"
          value={String(limits?.maxAppServerReplicas ?? '—')}
        />
      </div>

      <div className="border-t border-[var(--c9-border)] px-4 py-4">
        <BenefitChecklist limits={limits} isFree={isFree} />
        {isFree ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={onUpgrade}
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
        ) : null}
        {showPaidBilling ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-[var(--c9-muted)]">
              {canCancelAndRefund
                ? MANAGE_BILLING_HINT
                : MANAGE_BILLING_HINT_STOP_ONLY}
            </p>
            <button
              type="button"
              disabled={billingBusy}
              onClick={onStop}
              className="w-full rounded-lg border border-[var(--c9-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] hover:text-[var(--c9-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billingBusy ? 'Opening portal…' : STOP_SUBSCRIPTION_LABEL}
            </button>
            {canCancelAndRefund ? (
              <button
                type="button"
                disabled={billingBusy}
                onClick={onCancel}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
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
      </div>
    </C9Card>
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
