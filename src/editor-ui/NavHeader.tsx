import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../product/stores/authStore'
import { loginPathWithReturnTo } from '../lib/authReturn'

const linkBase =
  'relative px-2 py-1.5 text-sm transition-colors duration-200 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)]'

function NavLink({
  to,
  children,
  active,
}: {
  to: string
  children: ReactNode
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={`${linkBase} ${
        active
          ? 'text-[var(--c9-text-heading)]'
          : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
      {active ? (
        <span
          className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--c9-accent)]"
          aria-hidden
        />
      ) : null}
    </Link>
  )
}

export default function NavHeader() {
  const { pathname } = useLocation()
  const session = useAuthStore((s) => s.session)
  const loginHref = loginPathWithReturnTo(pathname)
  if (
    pathname === '/' ||
    pathname === '/canvas' ||
    pathname === '/canvas-pixi' ||
    pathname === '/canvas-svg'
  )
    return null

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-[var(--c9-border)] bg-[var(--c9-bg)]/90 px-6 py-3 backdrop-blur-sm">
      <Link
        to={session ? '/dashboard' : '/'}
        className="text-lg font-semibold tracking-tight text-[var(--c9-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)]"
      >
        RunCloud9
      </Link>
      <nav className="flex items-center gap-1 sm:gap-3">
        {session ? (
          <NavLink to="/dashboard" active={pathname === '/dashboard'}>
            Dashboard
          </NavLink>
        ) : null}
        <NavLink to="/pricing" active={pathname === '/pricing'}>
          Pricing
        </NavLink>
        <NavLink to="/canvas" active={false}>
          Open Canvas
        </NavLink>
        {session ? (
          <>
            <NavLink to="/profile" active={pathname === '/profile'}>
              Profile
            </NavLink>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className={`${linkBase} text-[var(--c9-muted)] hover:text-[var(--c9-text)]`}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to={loginHref}
            className="ml-1 rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)] active:scale-[0.98]"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}
