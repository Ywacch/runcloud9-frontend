import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p className="text-xs uppercase tracking-wider text-[var(--c9-muted)]">
        Draft · invite alpha · last updated July 2026
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
        Paid Engineer tiers are billed through Stripe under the prices shown at checkout. Fees are
        non-refundable except where required by law. You may cancel per Stripe subscription
        settings; access continues through the paid period.
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

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Contact</h2>
      <p>
        Terms questions:{' '}
        <a href="mailto:legal@runcloud9.io" className="text-[var(--c9-accent)] hover:underline">
          legal@runcloud9.io
        </a>{' '}
        (placeholder — update before public launch).
      </p>
    </LegalPageLayout>
  )
}
