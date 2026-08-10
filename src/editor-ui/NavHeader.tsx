import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../product/stores/authStore'
import { loginPathWithReturnTo } from '../lib/authReturn'
import { hasDevAccountAccess } from '../lib/devAccountPreview'

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

const signInCtaClass =
  'ml-1 rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)] active:scale-[0.98]'

function HeaderLinks({
  pathname,
  accountAccess,
}: {
  pathname: string
  accountAccess: boolean
}) {
  return (
    <>
      {accountAccess ? (
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
      {accountAccess ? (
        <NavLink to="/profile" active={pathname === '/profile'}>
          Profile
        </NavLink>
      ) : null}
    </>
  )
}

function HeaderAuth({
  session,
  accountAccess,
  loginHref,
}: {
  session: ReturnType<typeof useAuthStore.getState>['session']
  accountAccess: boolean
  loginHref: string
}) {
  if (!accountAccess || !session) {
    return (
      <Link to={loginHref} className={signInCtaClass}>
        Sign in
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void supabase.auth.signOut()}
      className={`${linkBase} text-[var(--c9-muted)] hover:text-[var(--c9-text)]`}
    >
      Sign out
    </button>
  )
}

export default function NavHeader() {
  const { pathname } = useLocation()
  const session = useAuthStore((s) => s.session)
  const accountAccess = hasDevAccountAccess(session)
  const loginHref = loginPathWithReturnTo(pathname)
  if (
    pathname === '/' ||
    pathname === '/canvas' ||
    pathname === '/canvas-pixi' ||
    pathname === '/canvas-svg'
  )
    return null

  return (
    <header className="c9-nav-header fixed top-0 z-50 flex w-full items-center justify-between border-b-2 border-[var(--c9-border-strong)] bg-[var(--c9-bg)] px-6 py-3">
      <Link
        to={accountAccess ? '/dashboard' : '/'}
        className="text-lg font-semibold tracking-tight text-[var(--c9-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)]"
      >
        RunCloud9
      </Link>
      <nav className="flex items-center gap-1 sm:gap-3">
        <HeaderLinks pathname={pathname} accountAccess={accountAccess} />
        <HeaderAuth session={session} accountAccess={accountAccess} loginHref={loginHref} />
      </nav>
    </header>
  )
}
