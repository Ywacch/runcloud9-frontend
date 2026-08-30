import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '../components/landing/Footer'
import { PlanCompareTable } from '../components/pricing/PlanCompareTable'
import { PricingPlanColumn } from '../components/pricing/PricingPlanColumn'
import { startEngineerUpgrade } from '../editor-ui/PlanLimitsCard'
import { loginPathWithReturnTo } from '../lib/authReturn'
import {
  ENGINEER_PRICE_DISPLAY,
  EXPLORER_PRICE_DISPLAY,
  MANAGE_BILLING_HINT,
  engineerUpgradeCta,
} from '../lib/billingCopy'
import { BILLING_ENABLED } from '../lib/featureFlags'
import { useAuthStore } from '../product/stores/authStore'

const PRICING_FAQS: { q: string; a: string }[] = [
  {
    q: 'What can Free tier deploy?',
    a: 'Free tier deploys free templates on the free tier designs. Certain component types stay locked.',
  },
  {
    q: 'How long are sessions?',
    a: 'Free tier sessions are 9 minutes. Engineer defaults to 9 minutes and can run up to 15 minutes per session.',
  },
  {
    q: 'How do Stop and Cancel work?',
    a: MANAGE_BILLING_HINT,
  },
  {
    q: 'Is the listed Engineer price final?',
    a: 'Stripe checkout is authoritative. The price on this page is for display only and may show “Shown at checkout” until a marketing label is configured.',
  },
]

export default function PricingPage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const isFree =
    !currentUser ||
    currentUser.effectiveTier === 'free' ||
    currentUser.effectiveTier == null
  const isPaid =
    !!currentUser &&
    currentUser.effectiveTier !== 'free' &&
    !currentUser.isInternal
  const upgradeCta = engineerUpgradeCta(BILLING_ENABLED)
  const loginHref = loginPathWithReturnTo('/pricing')

  const handleUpgrade = () => {
    setCheckoutError(null)
    setCheckoutBusy(true)
    startEngineerUpgrade(setCheckoutError, () => setCheckoutBusy(false))
  }

  const engineerPrimary =
    'inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]'
  const engineerSecondary =
    'inline-flex w-full items-center justify-center rounded-lg border border-[var(--c9-border)] px-4 py-2.5 text-sm font-medium text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]'

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--c9-bg)]">
      <main className="flex-1 px-6 pt-24 pb-16">
        <div className="mx-auto max-w-5xl space-y-14">
          <header className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--c9-text)] md:text-4xl">
              Subscription plans
            </h1>
            <p className="mt-3 text-base leading-relaxed text-[var(--c9-muted)]">
              Design on a canvas, deploy to real Kubernetes, and watch the system under load.
              Start on Free tier; Engineer unlocks the full template shape and higher limits.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <PricingPlanColumn
              name="Free tier"
              price={EXPLORER_PRICE_DISPLAY}
              priceHint="forever"
              blurb="Deploy free templates on the free tier designs. Preview full architectures with certain component types locked."
              plain
            >
              {session ? (
                <Link
                  to="/canvas"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--c9-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] hover:text-[var(--c9-accent)]"
                >
                  Open canvas
                </Link>
              ) : (
                <Link
                  to={loginHref}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--c9-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] hover:text-[var(--c9-accent)]"
                >
                  Sign in to start
                </Link>
              )}
            </PricingPlanColumn>


            <PricingPlanColumn
              name="Engineer"
              price={ENGINEER_PRICE_DISPLAY}
              priceHint={
                ENGINEER_PRICE_DISPLAY === 'Shown at checkout'
                  ? 'at Stripe checkout'
                  : 'per month'
              }
              blurb="Load balancers, queues, workers, proxy cache strategies, all templates, and higher session quotas."
              plain
            >
              {!session ? (
                <Link to={loginHref} className={engineerPrimary}>
                  Sign in to upgrade
                </Link>
              ) : isPaid || currentUser?.isInternal ? (
                <div className="flex gap-2">
                  <Link to="/canvas" className={engineerPrimary}>
                    Open canvas
                  </Link>
                  <Link to="/profile" className={engineerSecondary}>
                    Manage plan
                  </Link>
                </div>
              ) : isFree && upgradeCta ? (
                <>
                  <button
                    type="button"
                    disabled={checkoutBusy}
                    onClick={handleUpgrade}
                    className={`${engineerPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {checkoutBusy ? 'Starting checkout…' : upgradeCta.label}
                  </button>
                  {checkoutError ? (
                    <p className="text-xs text-red-400" role="alert">
                      {checkoutError}
                    </p>
                  ) : null}
                </>
              ) : (
                <Link to="/profile" className={engineerSecondary}>
                  View plan on profile
                </Link>
              )}
            </PricingPlanColumn>

          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--c9-text)]">
              Compare plans
            </h2>
            <PlanCompareTable />
          </section>

          <section className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-lg font-semibold text-[var(--c9-text)]">FAQ</h2>
            <dl className="space-y-5">
              {PRICING_FAQS.map((item) => (
                <div key={item.q}>
                  <dt className="text-sm font-semibold text-[var(--c9-text)]">
                    {item.q}
                  </dt>
                  <dd className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-[var(--c9-muted)]">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
