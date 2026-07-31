import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p className="text-xs uppercase tracking-wider text-[var(--c9-muted)]">
        Draft · invite alpha · last updated July 2026
      </p>
      <p>
        This policy describes how RunCloud9 handles information during the invite alpha. It is
        not legal advice; we will revise it as the product matures.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">What we collect</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-[var(--c9-text)]">Account data:</strong> email address and
          authentication identifiers via Supabase (invite sign-in, password reset).
        </li>
        <li>
          <strong className="text-[var(--c9-text)]">Session data:</strong> deployment designs,
          namespace metadata, session duration, and summarized metrics stored with your account.
        </li>
        <li>
          <strong className="text-[var(--c9-text)]">Usage analytics:</strong> product events
          (e.g. canvas opened, deploy requested) via PostHog, with coarse error categories — not
          raw backend error text.
        </li>
        <li>
          <strong className="text-[var(--c9-text)]">Diagnostics:</strong> client errors and
          performance signals via Sentry when enabled.
        </li>
        <li>
          <strong className="text-[var(--c9-text)]">Billing:</strong> if you upgrade, payment
          processing is handled by Stripe; we receive subscription status, not full card numbers.
        </li>
      </ul>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">How we use it</h2>
      <p>
        To operate the service (provision sessions, enforce quotas, authenticate users), improve
        reliability and UX, and process Engineer subscriptions. We do not sell your personal data.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Retention</h2>
      <p>
        Live cluster resources are torn down when sessions end. Account and deployment history rows
        are kept for the alpha to support dashboards and support. Analytics and error data follow
        each provider&apos;s retention settings (PostHog, Sentry). We may delete inactive alpha
        accounts after reasonable notice.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Processors</h2>
      <p>
        We rely on Supabase (auth and app data), Google Cloud (Kubernetes workloads), Stripe
        (billing), PostHog (analytics), and Sentry (error monitoring). Each processes data under
        their own terms and our instructions for providing the product.
      </p>

      <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">Contact</h2>
      <p>
        Privacy questions during alpha:{' '}
        <a href="mailto:privacy@runcloud9.io" className="text-[var(--c9-accent)] hover:underline">
          privacy@runcloud9.io
        </a>{' '}
        (placeholder — update before public launch).
      </p>
    </LegalPageLayout>
  )
}
