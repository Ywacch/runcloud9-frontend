import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function LegalPageLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="min-h-[100dvh] bg-[var(--c9-bg)] px-6 pt-24 pb-16">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--c9-text)]">
          {title}
        </h1>
        <div className="prose-legal mt-8 space-y-4 text-sm leading-relaxed text-[var(--c9-muted)]">
          {children}
        </div>
        <p className="mt-10 text-xs text-[var(--c9-muted)]">
          <Link to="/" className="text-[var(--c9-accent)] hover:underline">
            Back to home
          </Link>
          {' · '}
          <Link to="/about" className="hover:text-[var(--c9-text)]">
            About
          </Link>
          {' · '}
          <Link to="/pricing" className="hover:text-[var(--c9-text)]">
            Pricing
          </Link>
          {' · '}
          <Link to="/privacy" className="hover:text-[var(--c9-text)]">
            Privacy
          </Link>
          {' · '}
          <Link to="/terms" className="hover:text-[var(--c9-text)]">
            Terms
          </Link>
        </p>
      </article>
    </main>
  )
}
