import { Link } from 'react-router-dom'
import { C9Card } from '../editor-ui/c9Primitives'

export default function BillingCancelPage() {
  return (
    <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <C9Card className="w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
          Checkout cancelled
        </h1>
        <p className="mt-2 text-sm text-[var(--c9-muted)]">
          No charge was made. You can upgrade anytime from your profile.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/profile"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
          >
            Back to profile
          </Link>
          <Link
            to="/canvas"
            className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--c9-border)] px-4 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors hover:bg-[var(--c9-badge-bg)]"
          >
            Open canvas
          </Link>
        </div>
      </C9Card>
    </main>
  )
}
