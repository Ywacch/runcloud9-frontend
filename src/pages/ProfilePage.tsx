import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { loginPathWithReturnTo } from '../lib/authReturn'
import { refreshCurrentUser } from '../lib/auth'
import { getMe } from '../lib/api'
import { PlanLimitsCard, startEngineerUpgrade } from '../editor-ui/PlanLimitsCard'
import { C9Card } from '../editor-ui/c9Primitives'
import { Footer } from '../components/landing/Footer'
import {
  CANCEL_SUCCESS_BODY_NO_REFUND,
  CANCEL_SUCCESS_BODY_REFUNDED,
  CANCEL_SUCCESS_TITLE,
} from '../lib/billingCopy'
import { hasDevAccountAccess } from '../lib/devAccountPreview'
import { BILLING_ENABLED } from '../lib/featureFlags'
import {
  checkCancelEligibility,
  startBillingPortal,
  startCancelSubscription,
  StripeCheckoutError,
} from '../lib/stripeCheckout'

export default function ProfilePage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser)

  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [cancelSuccessRefunded, setCancelSuccessRefunded] = useState<
    boolean | null
  >(null)
  const [canCancelAndRefund, setCanCancelAndRefund] = useState(false)

  const showPaidBilling =
    !!currentUser &&
    currentUser.effectiveTier !== 'free' &&
    !currentUser.isInternal

  useEffect(() => {
    if (!hasDevAccountAccess(session) || currentUser) return
    void refreshCurrentUser()
  }, [session, currentUser])

  useEffect(() => {
    if (!BILLING_ENABLED || !showPaidBilling) {
      setCanCancelAndRefund(false)
      return
    }
    let cancelled = false
    void checkCancelEligibility()
      .then((ok) => {
        if (!cancelled) setCanCancelAndRefund(ok)
      })
      .catch(() => {
        if (!cancelled) setCanCancelAndRefund(false)
      })
    return () => {
      cancelled = true
    }
  }, [showPaidBilling, currentUser?.userId, currentUser?.effectiveTier])

  if (!hasDevAccountAccess(session)) {
    return (
      <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <div className="w-full max-w-md rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)] p-6 text-center shadow-xl shadow-black/20">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            Sign in to view your profile
          </h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Your plan, limits, and upgrade options are available after signing in.
          </p>
          <Link
            to={loginPathWithReturnTo('/profile')}
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const handleUpgrade = () => {
    setCheckoutError(null)
    setCheckoutBusy(true)
    startEngineerUpgrade(setCheckoutError, () => setCheckoutBusy(false))
  }

  const handleStop = () => {
    setBillingError(null)
    setBillingBusy(true)
    void startBillingPortal()
      .catch((err: unknown) => {
        setBillingError(
          err instanceof StripeCheckoutError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not open billing portal.',
        )
      })
      .finally(() => setBillingBusy(false))
  }

  const handleCancel = () => {
    setBillingError(null)
    setCancelSuccessRefunded(null)
    setBillingBusy(true)
    void startCancelSubscription()
      .then(async (result) => {
        try {
          const me = await getMe()
          setCurrentUser(me)
        } catch {
          /* tier refresh best-effort; webhook may still be in flight */
        }
        setCanCancelAndRefund(false)
        setCancelSuccessRefunded(result.refunded === true)
      })
      .catch((err: unknown) => {
        setBillingError(
          err instanceof StripeCheckoutError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not cancel subscription.',
        )
      })
      .finally(() => setBillingBusy(false))
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--c9-bg)]">
      <main className="flex-1 px-6 pt-24 pb-16">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--c9-text)]">
                Profile
              </h1>
            <p className="mt-1 text-sm text-[var(--c9-muted)]">
              {BILLING_ENABLED ? 'Plan, limits, and billing' : 'Plan and limits'}
            </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="text-sm text-[var(--c9-accent)] transition-colors hover:text-[var(--c9-accent-hover)]"
              >
                View past runs
              </Link>
            </div>
          </div>

          {!currentUser ? (
            <p className="text-sm text-[var(--c9-muted)]">Loading plan info…</p>
          ) : (
            <PlanLimitsCard
              key={`${currentUser.userId}-${currentUser.effectiveTier}`}
              effectiveTier={currentUser.effectiveTier}
              isInternal={currentUser.isInternal}
              limits={currentUser.limits}
              sessionsRemainingThisMonth={currentUser.sessionsRemainingThisMonth}
              checkoutBusy={checkoutBusy}
              checkoutError={checkoutError}
              onUpgrade={handleUpgrade}
              onStop={handleStop}
              onCancel={handleCancel}
              billingBusy={billingBusy}
              billingError={billingError}
              canCancelAndRefund={canCancelAndRefund}
            />
          )}
        </div>
      </main>
      <Footer />

      {cancelSuccessRefunded !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/75 px-6 backdrop-blur-sm"
          role="presentation"
          onClick={() => setCancelSuccessRefunded(null)}
        >
          <C9Card
            className="w-full max-w-md p-6 text-center shadow-xl shadow-black/30"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-success-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="cancel-success-title"
              className="text-xl font-semibold tracking-tight text-[var(--c9-text)]"
            >
              {CANCEL_SUCCESS_TITLE}
            </h2>
            <p className="mt-2 text-sm text-[var(--c9-muted)]">
              {cancelSuccessRefunded
                ? CANCEL_SUCCESS_BODY_REFUNDED
                : CANCEL_SUCCESS_BODY_NO_REFUND}
            </p>
            <button
              type="button"
              className="mt-5 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
              onClick={() => setCancelSuccessRefunded(null)}
            >
              OK
            </button>
          </C9Card>
        </div>
      ) : null}
    </div>
  )
}
