import { Link } from 'react-router-dom'

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

const FOOTER_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
] as const

export function Footer() {
  return (
    <footer className="border-t border-c9-border bg-c9-bg pb-10 pt-14">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 md:px-10">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <Link to="/" className="inline-block transition-opacity hover:opacity-90">
              <RunCloud9Logo />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-c9-text-muted">
              Design distributed systems on a canvas, deploy to real Kubernetes, and observe
              them under load.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-c9-text-muted transition-colors hover:text-c9-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="border-t border-c9-border pt-6 text-xs text-c9-text-muted">
          © {new Date().getFullYear()} RunCloud9. Invite-only alpha.
        </p>
      </div>
    </footer>
  )
}
