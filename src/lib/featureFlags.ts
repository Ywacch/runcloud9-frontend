/**
 * Concurrent deployment loadtest admin page (`/loadtest`).
 * Set `VITE_ENABLE_LOADTEST_ROUTE=true` in `.env.local` or flip the constant when re-enabling.
 */
export const LOADTEST_ROUTE_ENABLED =
  import.meta.env.VITE_ENABLE_LOADTEST_ROUTE === 'true'
