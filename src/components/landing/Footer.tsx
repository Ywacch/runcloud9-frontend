import { Link } from 'react-router-dom'
import { DISCORD_INVITE_URL } from '../../lib/featureFlags'
import { requestCookieSettings } from '../../lib/cookieConsent'
import { RunCloud9Logo } from '../brand/RunCloud9Logo'

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
