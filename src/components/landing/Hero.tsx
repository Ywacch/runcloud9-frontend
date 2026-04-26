import { ScreenshotFrame } from './ScreenshotFrame'
import { Link } from 'react-router-dom'

export function Hero() {
  return (
    <section className="dot-grid relative flex min-h-screen items-center overflow-hidden bg-[var(--c9-bg)] pt-16">
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl dark:bg-indigo-500/10" />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-2">
        <div>
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-[var(--c9-badge-bg)] px-3 py-1 text-xs font-medium text-[var(--c9-badge-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c9-accent)]" />
            Kubernetes-Native Deployment Engine
          </span>

          <h1 className="mb-6 text-4xl font-semibold tracking-tight text-[var(--c9-text)] md:text-5xl lg:text-6xl lg:leading-[1.1]">
            Design, Deploy,
            <br />
            Observe;
            <br />
            <span className="text-[var(--c9-accent)]">All in One Canvas.</span>
          </h1>

          <p className="mb-10 max-w-md text-lg leading-relaxed text-[var(--c9-muted)]">
            RunCloud9 lets you drop real components (load balancers, databases,
            caches, message queues, etc) onto a canvas and deploy them onto live
            Kubernetes infrastructure. Then hit them with traffic, introduce chaos,
            and spend 9 minutes watching a real system breathe.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/canvas"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--c9-accent)] px-6 py-3 font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
            >
              Start Building
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

        </div>

        <div className="relative -rotate-1 transition-transform duration-500 hover:rotate-0">
          <ScreenshotFrame />
          <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-3 py-2 shadow-lg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs text-[var(--c9-muted)]">3 pods healthy</span>
          </div>
        </div>
      </div>
    </section>
  )
}
