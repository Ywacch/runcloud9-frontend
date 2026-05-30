import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import { useAuthStore } from '../../product/stores/authStore'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Docs', href: '#' },
] as const

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
          <RunCloud9Logo theme={theme} />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-c9-text-muted transition-colors hover:text-c9-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded border border-c9-border text-c9-text-muted transition-colors hover:text-c9-text"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
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
              to="/login"
              className="px-3 py-1.5 text-sm text-c9-text-muted transition-colors hover:text-c9-text"
            >
              Log in
            </Link>
          )}
          <Link
            to="/canvas"
            className="rounded border border-c9-border-strong bg-c9-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-c9-accent-hover"
          >
            Go to Canvas
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
            {NAV_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-c9-text-muted transition-colors hover:text-c9-text"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded border border-c9-border px-4 py-2 text-left text-sm text-c9-text-muted"
            >
              Toggle theme
            </button>
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
                to="/login"
                className="px-3 py-1.5 text-sm text-c9-text-muted transition-colors hover:text-c9-text"
              >
                Log in
              </Link>
            )}
            <Link
              to="/canvas"
              className="rounded border border-c9-border-strong bg-c9-accent px-4 py-2 text-center text-sm font-medium text-white"
            >
              Go to Canvas
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}

function RunCloud9Logo({ theme }: { theme: 'dark' | 'light' }) {
  const stroke = theme === 'dark' ? 'var(--color-c9-400)' : 'var(--color-c9-600)'
  const fill =
    theme === 'dark'
      ? 'color-mix(in srgb, var(--color-c9-500) 16%, transparent)'
      : 'var(--color-c9-accent-muted)'

  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden>
        <path
          d="M6.2 16.8h13.4a5 5 0 0 0 .6-9.97 6.8 6.8 0 0 0-13.1 2A4.2 4.2 0 0 0 6.2 16.8Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
        />
      </svg>
      <span className="font-sans text-base font-medium text-c9-text-heading">RunCloud9</span>
    </div>
  )
}
