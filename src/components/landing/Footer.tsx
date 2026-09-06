import { Link } from 'react-router-dom'
import { DISCORD_INVITE_URL } from '../../lib/featureFlags'
import { requestCookieSettings } from '../../lib/cookieConsent'

function RunCloud9Logo() {
  return (
    <div className="flex items-center gap-[0.45rem]">
      <svg
        width="28"
        height="20"
        viewBox="0 0 28 20"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <path
          d="M6.2 16.8h13.4a5 5 0 0 0 .6-9.97 6.8 6.8 0 0 0-13.1 2A4.2 4.2 0 0 0 6.2 16.8Z"
          fill="color-mix(in srgb, var(--color-c9-400) 42%, transparent)"
          stroke="var(--color-c9-200)"
          strokeWidth="1.4"
        />
      </svg>
      <span className="font-sans text-base font-semibold tracking-[-0.02em] text-c9-text-heading">
        RunCloud9
      </span>
    </div>
  )
}

const FOOTER_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Cookies', to: '/cookies' },
] as const

export function Footer() {
  return (
    <footer className="border-t border-c9-border bg-c9-bg py-5">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-[1.025rem] px-6 md:px-10">
        <Link to="/" className="inline-block transition-opacity hover:opacity-90">
          <RunCloud9Logo />
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-c9-text-muted transition-colors hover:text-c9-text"
            >
              {link.label}
            </Link>
          ))}
          {DISCORD_INVITE_URL ? (
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-c9-text-muted transition-colors hover:text-c9-text"
            >
              Discord
            </a>
          ) : null}
          <button
            type="button"
            onClick={requestCookieSettings}
            className="text-sm text-c9-text-muted transition-colors hover:text-c9-text"
          >
            Cookie settings
          </button>
        </nav>
        <p className="text-xs text-c9-text-muted">
          © {new Date().getFullYear()} RunCloud9
        </p>
      </div>
    </footer>
  )
}
