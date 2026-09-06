/**
 * Concurrent deployment loadtest admin page (`/loadtest`).
 * Set `VITE_ENABLE_LOADTEST_ROUTE=true` in `.env.local` or flip the constant when re-enabling.
 */
export const LOADTEST_ROUTE_ENABLED =
  import.meta.env.VITE_ENABLE_LOADTEST_ROUTE === 'true'

/**
 * Stripe checkout / portal / cancel UI.
 * Off by default until live billing is ready. Set `VITE_BILLING_ENABLED=true` to show.
 */
export const BILLING_ENABLED =
  import.meta.env.VITE_BILLING_ENABLED === 'true'

/** Discord invite for support / contact. Empty string hides the footer link. */
export const DISCORD_INVITE_URL = String(
  import.meta.env.VITE_DISCORD_INVITE_URL ?? '',
).trim()

/**
 * Local simulation worker UI (Simulator button, Flow panel, sim-only templates).
 * Off by default for public launch. Set `VITE_SHOW_SIMULATION_UI=true` to restore.
 */
export const SHOW_SIMULATION_UI =
  import.meta.env.VITE_SHOW_SIMULATION_UI === 'true'
