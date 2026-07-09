import type { IncomingMessage } from 'node:http'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

/** Narrow surface of http-proxy used here — avoids a direct dependency on `http-proxy` / its types. */
interface ProxyLike {
  on(event: 'error', listener: (err: Error, req: IncomingMessage) => void): void
}

function attachProxyDebug(proxy: ProxyLike, apiOrigin: string, label: string) {
  proxy.on('error', (err: Error, req: IncomingMessage) => {
    const path = (req as IncomingMessage & { url?: string }).url ?? ''
    // One clear line + hint — ECONNREFUSED almost always means nothing listening on apiOrigin.
    console.error(
      `[vite proxy:${label}] ${req.method ?? '?'} ${path} -> ${apiOrigin}\n` +
        `  ${err.name}: ${err.message}\n` +
        `  Nothing is accepting connections there — usually the API is not running or uses another port.\n` +
        `  1) From ganymede: set SUPABASE_URL + SUPABASE_SERVICE_KEY, then: go run ./cmd/api  (default listens on :8080)\n` +
        `  2) Check: open or curl ${apiOrigin.replace(/\/$/, '')}/health — should return {"status":"ok"}\n` +
        `  3) If your API uses a different URL/port, set VITE_DEV_API_ORIGIN in .env.local and restart pnpm dev.`,
    )
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev proxy target for RunCloud9 API (ganymede cmd/api defaults to :8080). Use 127.0.0.1 to avoid some Windows localhost/IPv6 quirks.
  const apiOrigin = env.VITE_DEV_API_ORIGIN || 'http://127.0.0.1:8080'

  // Printed when the dev server starts — confirms which origin is used (catches wrong .env).
  console.info(`[runcloud9] Vite dev API proxy -> ${apiOrigin}`)

  const sentryUpload =
    process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT

  const common = {
    target: apiOrigin,
    changeOrigin: true,
    configure: (proxy: ProxyLike) => attachProxyDebug(proxy, apiOrigin, 'api'),
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(sentryUpload
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG!,
              project: process.env.SENTRY_PROJECT!,
              authToken: process.env.SENTRY_AUTH_TOKEN!,
            }),
          ]
        : []),
    ],
    build: {
      // Landing stays small; /canvas async chunk bundles Pixi (~500 KB+ minified).
      chunkSizeWarningLimit: 1300,
      sourcemap: sentryUpload ? 'hidden' : false,
    },
    server: {
      port: 3000,
      proxy: {
        '/deployments': {
          ...common,
          ws: true,
        },
        '/templates': {
          ...common,
        },
        '/me': {
          ...common,
        },
        '/meta': {
          ...common,
        },
      },
    },
  }
})
