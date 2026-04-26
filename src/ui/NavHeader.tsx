import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function NavHeader() {
  const { pathname } = useLocation()
  const session = useAuthStore((s) => s.session)
  if (pathname === '/' || pathname === '/canvas') return null

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-[var(--c9-border)] bg-[var(--c9-bg)]/90 px-6 py-3 backdrop-blur-sm">
      <Link
        to="/"
        className="text-lg font-semibold tracking-tight text-[var(--c9-text)]"
      >
        RunCloud9
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/canvas"
          className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-2 text-sm text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
        >
          Open Canvas
        </Link>
        {session ? (
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-2 text-sm text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/login"
            className="rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
