import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../product/stores/authStore'
import { loginPathWithReturnTo } from '../lib/authReturn'
import { hasDevAccountAccess } from '../lib/devAccountPreview'
import { RunCloud9Logo } from '../components/brand/RunCloud9Logo'

const linkBase =
  'relative px-2 py-1.5 text-sm transition-colors duration-200 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)]'

const canvasLinkBase =
  'inline-flex items-center whitespace-nowrap px-3 text-[15px] font-semibold text-[var(--dt-color-text-muted)] shadow-[inset_0_-2px_0_transparent] hover:bg-transparent hover:text-[var(--dt-color-text-strong)] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dt-color-focus)] max-[1180px]:px-[9px] max-[1180px]:text-[14px]'

const canvasLinkCurrent =
  'text-[var(--dt-color-text-strong)] shadow-[inset_0_-2px_0_var(--dt-color-primary)]'

const canvasPlanLink =
  'whitespace-nowrap px-0.5 py-1 text-[13px] font-semibold text-[var(--dt-color-text-muted)] hover:text-[var(--dt-color-text-strong)] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dt-color-focus)]'

const signInCtaClass =
  'ml-1 rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)] active:scale-[0.98]'

const canvasSignInClass =
  'inline-flex h-[30px] items-center rounded-[7px] bg-[var(--dt-color-primary)] px-3 text-[12px] font-bold text-white shadow-[0_6px_18px_rgba(20,60,200,0.35)] hover:bg-[var(--dt-color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dt-color-focus)] active:translate-y-px'

function NavLink({
  to,
  children,
  active,
  canvas = false,
}: {
  to: string
  children: ReactNode
  active: boolean
  canvas?: boolean
}) {
  if (canvas) {
    return (
      <Link
        to={to}
        className={`${canvasLinkBase} ${active ? canvasLinkCurrent : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {children}
      </Link>
    )
  }

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

function HeaderLinks({
  pathname,
  accountAccess,
  canvas = false,
}: {
  pathname: string
  accountAccess: boolean
  canvas?: boolean
}) {
  return (
    <>
      {accountAccess ? (
        <NavLink to="/dashboard" active={pathname === '/dashboard'} canvas={canvas}>
          Dashboard
        </NavLink>
      ) : null}
      <NavLink to="/canvas" active={canvas && pathname === '/canvas'} canvas={canvas}>
        {canvas ? 'Canvas' : 'Open Canvas'}
      </NavLink>
      {accountAccess && !canvas ? (
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
  canvas = false,
}: {
  session: ReturnType<typeof useAuthStore.getState>['session']
  accountAccess: boolean
  loginHref: string
  canvas?: boolean
}) {
  if (!accountAccess || !session) {
    return (
      <Link to={loginHref} className={canvas ? canvasSignInClass : signInCtaClass}>
        Sign in
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void supabase.auth.signOut()}
      className={
        canvas
          ? canvasPlanLink
          : `${linkBase} text-[var(--c9-muted)] hover:text-[var(--c9-text)]`
      }
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
  const canvas = pathname === '/canvas'
  if (
    pathname === '/' ||
    pathname === '/canvas-pixi' ||
    pathname === '/canvas-svg'
  )
    return null

  if (canvas) {
    return (
      <header className="sticky top-0 z-50 border-b border-[var(--dt-color-divider)] bg-[var(--dt-color-page)] font-[family-name:var(--dt-font-family)] tracking-[0.15px] text-[var(--dt-color-text)]">
        <div className="flex h-16 items-center gap-[22px] px-6 max-[1180px]:gap-3.5 max-[860px]:px-3.5">
          <Link
            to={accountAccess ? '/dashboard' : '/'}
            aria-label="RunCloud9 home"
            className="flex items-center gap-[9px] text-[16px] font-bold tracking-[-0.01em] text-[var(--dt-color-text-strong)] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dt-color-focus)]"
          >
            <img
              src="/logo.png"
              alt=""
              width={22}
              height={22}
              decoding="async"
              className="h-[22px] w-[22px] shrink-0 object-contain"
            />
            RunCloud9
          </Link>
          <nav
            aria-label="Main navigation"
            className="mr-auto flex items-stretch gap-1.5 self-stretch max-[1180px]:gap-0.5"
          >
            <HeaderLinks pathname={pathname} accountAccess={accountAccess} canvas />
          </nav>
          <div className="flex items-center gap-2.5">
            {accountAccess ? (
              <Link to="/profile" className={canvasPlanLink}>
                Plan
              </Link>
            ) : null}
            <HeaderAuth
              session={session}
              accountAccess={accountAccess}
              loginHref={loginHref}
              canvas
            />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="c9-nav-header fixed top-0 z-50 flex w-full items-center justify-between border-b-2 border-[var(--c9-border-strong)] bg-[var(--c9-bg)] px-6 py-3">
      <Link
        to={accountAccess ? '/dashboard' : '/'}
        className="transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)]"
      >
        <RunCloud9Logo iconClassName="h-8 w-8" />
      </Link>
      <nav className="flex items-center gap-1 sm:gap-3">
        <HeaderLinks pathname={pathname} accountAccess={accountAccess} />
        <HeaderAuth session={session} accountAccess={accountAccess} loginHref={loginHref} />
      </nav>
    </header>
  )
}
