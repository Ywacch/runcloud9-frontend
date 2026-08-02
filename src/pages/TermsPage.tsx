import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p className="text-xs uppercase tracking-wider text-[var(--c9-muted)]">
        Draft · invite alpha · last updated August 2026
      </p>
      <p>
        By using RunCloud9 during the invite alpha, you agree to these terms. If you do not agree,
        do not use the service.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Alpha service</h2>
      <p>
        RunCloud9 is experimental pre-release software. Features, limits, and availability may
        change without notice. There is no service-level agreement; sessions may fail, queue, or
        be terminated for capacity or abuse reasons.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Acceptable use</h2>
      <p>
        Use the platform for lawful learning and architecture experimentation. Do not attempt to
        disrupt shared infrastructure, probe other users&apos; sessions, upload malware, or run
        sustained attacks outside the provided load tools. We may suspend accounts that threaten
        cluster stability or violate fair use.
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
        billing from your profile.
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
        INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM ALPHA USE, TO THE MAXIMUM EXTENT
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
