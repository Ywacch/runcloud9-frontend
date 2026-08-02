/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
  /** Set to "1" to log analytics event names in development without requiring PostHog. */
  readonly VITE_ANALYTICS_DEBUG?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Set to "true" to show Stripe upgrade / Stop / Cancel UI. */
  readonly VITE_BILLING_ENABLED?: string
  /**
   * Marketing display for Engineer price (e.g. "$29"). Stripe remains charge authority.
   * Empty / unset → "Shown at checkout".
   */
  readonly VITE_ENGINEER_PRICE_LABEL?: string
  /** Discord invite URL for footer contact (e.g. https://discord.gg/…). */
  readonly VITE_DISCORD_INVITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.PNG' {
  const src: string
  export default src
}
