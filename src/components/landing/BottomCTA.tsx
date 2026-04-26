import { Link } from 'react-router-dom'

export function BottomCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[var(--c9-surface)] to-[var(--c9-bg)] py-32 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-6">
        <span className="mb-6 inline-flex rounded-full border border-indigo-500/20 bg-[var(--c9-badge-bg)] px-3 py-1 text-xs font-medium text-[var(--c9-badge-text)]">
          Start building today
        </span>
        <h2 className="mb-4 text-4xl font-semibold text-[var(--c9-text)]">
          Smarter infrastructure starts with seeing it.
        </h2>
        <p className="mb-10 text-[var(--c9-muted)]">
          Join engineering teams who deploy with confidence on Kubernetes.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="rounded-lg bg-[var(--c9-accent)] px-6 py-3 font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            Get Started for Free
          </Link>
          <a
            href="#"
            className="rounded-lg border border-[var(--c9-border)] px-6 py-3 font-medium text-[var(--c9-text)] transition-all duration-200 hover:border-[var(--c9-accent)]"
          >
            Book a Demo
          </a>
        </div>
        <p className="mt-6 text-xs text-[var(--c9-muted)]">No credit card required.</p>
      </div>
    </section>
  )
}
