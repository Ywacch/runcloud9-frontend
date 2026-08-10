import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../product/stores/authStore'
import { loginPathWithReturnTo } from '../../lib/authReturn'
import { hasDevAccountAccess } from '../../lib/devAccountPreview'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const session = useAuthStore((s) => s.session)
  const accountAccess = hasDevAccountAccess(session)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const primaryCta = session
    ? { to: '/dashboard', label: 'Dashboard' }
    : { to: '/canvas', label: 'Go to Canvas' }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 w-full transition-[background-color,border-color,backdrop-filter] duration-200 ${
        scrolled
          ? 'border-b border-c9-border bg-c9-bg/80 backdrop-blur-sm'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6 md:px-10">
        <Link to="/" className="transition-opacity hover:opacity-90">
          <RunCloud9Logo />
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          {accountAccess ? (
            <>
              <Link
                to="/dashboard"
                className="rounded border border-c9-border-strong px-4 py-1.5 text-sm text-c9-text-muted transition-colors hover:border-c9-accent hover:text-c9-text"
              >
                Dashboard
              </Link>
              {session ? (
                <button
                  type="button"
                  onClick={() => void supabase.auth.signOut()}
                  className="rounded border border-c9-border-strong px-4 py-1.5 text-sm text-c9-text-muted transition-colors hover:border-c9-accent hover:text-c9-text"
                >
                  Log out
                </button>
              ) : (
                <Link
                  to={loginPathWithReturnTo('/dashboard')}
                  className="px-3 py-1.5 text-sm text-c9-text-muted transition-colors hover:text-c9-text"
                >
                  Log in
                </Link>
              )}
            </>
          ) : (
            <Link
              to={loginPathWithReturnTo('/dashboard')}
              className="px-3 py-1.5 text-sm text-c9-text-muted transition-colors hover:text-c9-text"
            >
              Log in
            </Link>
          )}
          <Link
            to={primaryCta.to}
            className="rounded border border-c9-border-strong bg-c9-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-c9-accent-hover"
          >
            {primaryCta.label}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex rounded border border-c9-border px-3 py-2 text-c9-text md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-c9-border bg-c9-bg/95 px-6 py-4 backdrop-blur-sm md:hidden">
          <div className="flex flex-col gap-3">
            {accountAccess ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded border border-c9-border-strong px-4 py-2 text-center text-sm text-c9-text-muted"
                  onClick={() => setOpen(false)}
                >
                  Dashboard
                </Link>
                {session ? (
                  <button
                    type="button"
                    onClick={() => void supabase.auth.signOut()}
                    className="rounded border border-c9-border-strong px-4 py-2 text-left text-sm text-c9-text-muted"
                  >
                    Log out
                  </button>
                ) : (
                  <Link
                    to={loginPathWithReturnTo('/dashboard')}
                    className="px-3 py-1.5 text-sm text-c9-text-muted transition-colors hover:text-c9-text"
                    onClick={() => setOpen(false)}
                  >
                    Log in
                  </Link>
                )}
              </>
            ) : (
              <Link
                to={loginPathWithReturnTo('/dashboard')}
                className="px-3 py-1.5 text-sm text-c9-text-muted transition-colors hover:text-c9-text"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
            )}
            <Link
              to={primaryCta.to}
              className="rounded border border-c9-border-strong bg-c9-accent px-4 py-2 text-center text-sm font-medium text-white"
              onClick={() => setOpen(false)}
            >
              {primaryCta.label}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}

function RunCloud9Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden>
        <path
          d="M6.2 16.8h13.4a5 5 0 0 0 .6-9.97 6.8 6.8 0 0 0-13.1 2A4.2 4.2 0 0 0 6.2 16.8Z"
          fill="color-mix(in srgb, var(--color-c9-500) 16%, transparent)"
          stroke="var(--color-c9-400)"
          strokeWidth="1.6"
        />
      </svg>
      <span className="font-sans text-base font-medium text-c9-text-heading">RunCloud9</span>
    </div>
  )
}
