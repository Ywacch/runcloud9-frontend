import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import { useAuthStore } from '../../product/stores/authStore'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 w-full transition-all duration-200 ${
        isScrolled
          ? 'border-b border-[var(--c9-border)] bg-[var(--c9-bg)]/90 backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="transition-opacity hover:opacity-90">
          <RunCloud9Logo theme={theme} />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="#features"
            className="text-sm text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
          >
            Features
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c9-border)] text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          {session ? (
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="rounded-lg border border-[var(--c9-border)] px-4 py-2 text-sm text-[var(--c9-muted)] transition-all duration-200 hover:border-[var(--c9-accent)] hover:text-[var(--c9-text)]"
            >
              Log Out
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-lg border border-[var(--c9-border)] px-4 py-2 text-sm text-[var(--c9-muted)] transition-all duration-200 hover:border-[var(--c9-accent)] hover:text-[var(--c9-text)]"
            >
              Log In
            </Link>
          )}
          <Link
            to="/canvas"
            className="rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            Go to Canvas
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex rounded-lg border border-[var(--c9-border)] px-3 py-2 text-[var(--c9-text)] md:hidden"
          aria-label="Toggle menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
        <div className="border-t border-[var(--c9-border)] bg-[var(--c9-bg)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <a
              href="#features"
              className="text-sm text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
            >
              Features
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-2 rounded-lg border border-[var(--c9-border)] px-4 py-2 text-sm text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
            >
              Toggle Theme
            </button>
            {session ? (
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="rounded-lg border border-[var(--c9-border)] px-4 py-2 text-center text-sm text-[var(--c9-muted)]"
              >
                Log Out
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-lg border border-[var(--c9-border)] px-4 py-2 text-center text-sm text-[var(--c9-muted)]"
              >
                Log In
              </Link>
            )}
            <Link
              to="/canvas"
              className="rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-center text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
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
    theme === 'dark' ? 'color-mix(in srgb, var(--color-c9-500) 16%, transparent)' : 'var(--color-c9-accent-muted)'

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
      <span className="text-base font-semibold text-[var(--c9-text)]">RunCloud9</span>
    </div>
  )
}
