# Security headers (Vercel)

Browser hardening for the SPA is set in [`vercel.json`](../vercel.json). Headers apply on Vercel production/preview; local `vite` / `vite preview` do not serve them unless you add a matching proxy.

## Headers

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | camera/mic/geolocation disabled |
| `Content-Security-Policy` | allowlist below (enforced) |

## CSP allowlist

Keep this list in sync with Vercel / app env hosts (`VITE_SUPABASE_URL`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`, `VITE_DEPLOYMENTS_API_PREFIX`).

| Directive | Allowed |
| --- | --- |
| `default-src` | `'self'` |
| `script-src` | `'self'` (bundled app + PostHog/Sentry SDKs) |
| `style-src` | `'self'`, `https://fonts.googleapis.com` |
| `font-src` | `'self'`, `https://fonts.gstatic.com`, `data:` |
| `img-src` | `'self'`, `data:`, `blob:` (Pixi / assets) |
| `worker-src` / `child-src` | `'self'`, `blob:` (Sentry replay / workers) |
| `connect-src` | `'self'`; Supabase `https://*.supabase.co` + `wss://*.supabase.co`; PostHog `https://us.i.posthog.com`, `https://eu.i.posthog.com`, `https://*.i.posthog.com`; Sentry `https://*.ingest.sentry.io`, `https://*.ingest.us.sentry.io`; API `https://api.runcloud9.io`, `wss://api.runcloud9.io`, `https://www.runcloud9.io`, `wss://www.runcloud9.io` |
| `form-action` | `'self'`, `https://checkout.stripe.com` (Engineer checkout redirect) |
| `frame-ancestors` | `'none'` |
| `base-uri` | `'self'` |
| `object-src` | `'none'` |

## When a feature breaks under CSP

1. Open DevTools → Console for `Refused to ... because it violates the following Content Security Policy directive`.
2. Confirm the blocked host is intentional third-party traffic (not an XSS payload).
3. Add the minimal host to the matching directive in `vercel.json` and this doc.
4. Prefer host allowlists over `'unsafe-inline'` / `'unsafe-eval'`.

## No raw HTML

Do not use `dangerouslySetInnerHTML` or assign to `innerHTML`. Render strings as React text so the DOM escapes them. ESLint bans `dangerouslySetInnerHTML` via `no-restricted-syntax` in `eslint.config.js`. If HTML is ever required, use a sanitizer and get a security review.

A local Cursor rule lives at `.cursor/rules/no-raw-html.mdc` (gitignored with `.cursor/`).

## Smoke checklist (preview deploy)

- [ ] App shell loads (no CSP blocks on scripts/styles/fonts)
- [ ] Login / auth callback (Supabase REST + auth)
- [ ] Deploy / canvas API + websocket (`api.runcloud9.io` or same-origin `/deployments`)
- [ ] PostHog events when `VITE_POSTHOG_KEY` is set
- [ ] Sentry error capture when `VITE_SENTRY_DSN` is set
- [ ] Engineer checkout reaches Stripe Checkout
