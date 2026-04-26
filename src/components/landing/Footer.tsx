const COLUMNS = {
  Product: ['Infrastructure', 'Observability', 'Security', 'Pricing'],
  Resources: ['Documentation', 'API', 'Changelog'],
  Company: ['About', 'Blog', 'Careers'],
  Legal: ['Terms', 'Privacy', 'Security'],
}

function RunCloud9Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="28"
        height="20"
        viewBox="0 0 28 20"
        fill="none"
        aria-hidden
      >
        <path
          d="M6.2 16.8h13.4a5 5 0 0 0 .6-9.97 6.8 6.8 0 0 0-13.1 2A4.2 4.2 0 0 0 6.2 16.8Z"
          fill="var(--c9-badge-bg)"
          stroke="var(--c9-accent)"
          strokeWidth="1.6"
        />
      </svg>
      <span className="text-base font-semibold text-[var(--c9-text)]">RunCloud9</span>
    </div>
  )
}

function SocialIcon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--c9-border)] bg-[var(--c9-bg)] pb-8 pt-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="md:col-span-2">
            <RunCloud9Logo />
            <p className="mt-2 max-w-[180px] text-sm text-[var(--c9-muted)]">
              Mission control for Kubernetes.
            </p>
          </div>

          {Object.entries(COLUMNS).map(([title, links]) => (
            <div key={title}>
              <p className="mb-4 text-xs uppercase tracking-widest text-[var(--c9-muted)]">
                {title}
              </p>
              <div className="mt-3 space-y-2">
                {links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="block text-sm text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--c9-border)] pt-6 sm:flex-row">
          <p className="text-xs text-[var(--c9-muted)]">
            © 2024 RunCloud9 Orchestration, Inc.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
              aria-label="GitHub"
            >
              <SocialIcon path="M12 3a9 9 0 0 0-2.85 17.54c.45.08.6-.2.6-.43v-1.5c-2.43.53-2.95-1.17-2.95-1.17-.4-1-.98-1.26-.98-1.26-.8-.54.06-.53.06-.53.88.07 1.35.9 1.35.9.78 1.33 2.05.95 2.55.73.08-.57.3-.95.54-1.17-1.94-.22-3.98-.97-3.98-4.33 0-.96.35-1.75.9-2.37-.1-.22-.4-1.12.08-2.33 0 0 .74-.24 2.42.9a8.3 8.3 0 0 1 4.4 0c1.68-1.14 2.42-.9 2.42-.9.48 1.2.18 2.1.1 2.33.56.62.9 1.4.9 2.37 0 3.36-2.04 4.1-3.98 4.33.3.26.57.77.57 1.55v2.3c0 .24.17.52.6.43A9 9 0 0 0 12 3Z" />
            </a>
            <a
              href="#"
              className="text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
              aria-label="Twitter"
            >
              <SocialIcon path="M4 4 10.8 13.2 4.6 20h2.8l4.6-5 3.7 5H20l-7-9.4L18.7 4h-2.8l-4.1 4.5L8.4 4H4Z" />
            </a>
            <a
              href="#"
              className="text-[var(--c9-muted)] transition-colors duration-200 hover:text-[var(--c9-text)]"
              aria-label="LinkedIn"
            >
              <SocialIcon path="M7 8v9M7 5.5h.01M12 17v-5c0-1.2 1-2.1 2.2-2.1S16.5 10.8 16.5 12V17M5 20h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
