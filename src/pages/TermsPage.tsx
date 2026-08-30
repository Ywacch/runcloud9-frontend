import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p className="text-xs uppercase tracking-wider text-[var(--c9-muted)]">
        Last updated 30 August 2026
      </p>
      <p>
        By creating an account, signing in (email and password, Google, GitHub, or another method
        we offer), or using RunCloud9, you agree to these terms and our Privacy Policy. If you do
        not agree, do not use the service.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Accounts</h2>
      <p>
        One person may hold one account. Do not share credentials, create extra accounts to multiply
        free sessions or limits, or automate signups. We may require a verified email before you
        can deploy labs. We may suspend or close accounts that farm free capacity, evade limits,
        or otherwise abuse the service.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Service</h2>
      <p>
        RunCloud9 provisions short-lived lab environments on shared infrastructure. Features,
        limits, and availability may change. There is no service-level agreement. Sessions may
        fail, queue, or be terminated for capacity, maintenance, or abuse.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Acceptable use</h2>
      <p>
        Use the platform for lawful learning and architecture experimentation. Do not disrupt
        shared infrastructure, probe other users&apos; sessions, upload malware, or run sustained
        attacks outside the provided load tools. Do not use labs as general-purpose hosting or to
        attack systems you do not own. We may suspend accounts that threaten cluster stability or
        violate these rules.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Your content</h2>
      <p>
        You retain rights to designs you create. You grant us a limited license to store, transmit,
        and display them as needed to operate sessions (deploy, metrics, teardown). Template
        presets and platform software remain our property or our licensors&apos;.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Billing</h2>
      <p>
        Paid subscriptions are charged through Stripe at the price shown at checkout. You manage
        billing from your profile. Session and concurrent limits are those stated in the product
        at purchase.
      </p>
      <p>
        <strong className="font-medium text-[var(--c9-text)]">Stop subscription</strong> ends
        renewal. You keep paid access until the current billing period ends. We do not refund that
        period.
      </p>
      <p>
        <strong className="font-medium text-[var(--c9-text)]">Cancel &amp; refund</strong> ends
        paid access immediately and refunds the current period only if you have not used paid
        features in that Stripe billing period (no live sessions after the period started). If you
        have used them, Cancel &amp; refund is unavailable; use Stop instead.
      </p>
      <p>
        Unused time later in a period you already paid for does not entitle you to a refund. Where
        law requires a refund, that law controls.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. METRICS AND
        SIMULATIONS ARE DIRECTIONAL, NOT CERTIFICATION-GRADE. WE ARE NOT LIABLE FOR INDIRECT,
        INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM USE OF THE SERVICE, TO THE MAXIMUM EXTENT
        PERMITTED BY LAW.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Changes</h2>
      <p>
        We may update these terms. Continued use after changes constitutes acceptance. Material
        updates will be reflected on this page with a revised date.
      </p>
    </LegalPageLayout>
  )
}
