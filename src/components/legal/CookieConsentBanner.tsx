import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  acceptAnalyticsCookies,
  acceptEssentialCookiesOnly,
  onCookieSettingsRequested,
  readCookieConsent,
} from '../../lib/cookieConsent'

export function CookieConsentBanner() {
  const [open, setOpen] = useState(() => readCookieConsent() === null)

  useEffect(() => {
    return onCookieSettingsRequested(() => setOpen(true))
  }, [])

  const dismissEssential = useCallback(() => {
    acceptEssentialCookiesOnly()
    setOpen(false)
  }, [])

  const dismissAnalytics = useCallback(() => {
    acceptAnalyticsCookies()
    setOpen(false)
  }, [])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-c9-border bg-c9-bg/95 px-4 py-4 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <p
            id="cookie-consent-title"
            className="text-sm font-semibold text-c9-text-heading"
          >
            Cookie preferences
          </p>
          <p id="cookie-consent-desc" className="text-sm leading-relaxed text-c9-text-muted">
            We use essential cookies for sign-in and security. Analytics cookies (PostHog) help
            us improve RunCloud9 and are optional.{' '}
            <Link to="/cookies" className="text-c9-accent hover:underline">
              Cookie policy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={dismissEssential}
            className="rounded-lg border border-c9-border px-3 py-2 text-sm font-medium text-c9-text transition-colors hover:bg-c9-surface"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={dismissAnalytics}
            className="rounded-lg bg-c9-accent px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  )
}
