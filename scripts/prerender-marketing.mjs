/**
 * After `vite build`, write static HTML shells for public marketing routes.
 * Vercel serves these files before the SPA rewrite, so crawlers see real copy.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distIndex = join(root, 'dist', 'index.html')

const SITE = 'https://www.runcloud9.io'

const pages = [
  {
    out: join(root, 'dist', 'about', 'index.html'),
    title: 'About RunCloud9 | runcloud9',
    description:
      'RunCloud9 is an interactive distributed systems workbench: design architecture on a canvas and deploy to real Kubernetes for short sessions.',
    url: `${SITE}/about`,
    body: `<main>
  <h1>About RunCloud9</h1>
  <p>
    RunCloud9 is an interactive distributed systems workbench: an architecture lab on a
    canvas. You place load balancers, app servers, databases, caches, and queues, then
    deploy them to real Kubernetes for short sessions.
  </p>
  <p>
    Each session gets an isolated namespace, seeded data, load traffic, and live metrics.
    Start from URL shortener, e-commerce, or social feed presets, then change cache
    strategy, fan-out, and scale. Use simulation when a design is not ready to deploy.
  </p>
  <p>Invite-only alpha. <a href="/login">Sign in</a> or open your <a href="/dashboard">dashboard</a>.</p>
  <nav aria-label="Site">
    <a href="/">Home</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </nav>
</main>`,
  },
  {
    out: join(root, 'dist', 'privacy', 'index.html'),
    title: 'Privacy Policy | runcloud9',
    description:
      'How RunCloud9 handles account, session, analytics, and billing data during the invite alpha.',
    url: `${SITE}/privacy`,
    body: `<main>
  <h1>Privacy Policy</h1>
  <p>Draft · invite alpha · last updated July 2026</p>
  <p>
    This policy describes how RunCloud9 handles information during the invite alpha. It is
    not legal advice; we will revise it as the product matures.
  </p>
  <h2>What we collect</h2>
  <ul>
    <li><strong>Account data:</strong> email and auth identifiers via Supabase.</li>
    <li><strong>Session data:</strong> deployment designs, namespace metadata, and metrics.</li>
    <li><strong>Usage analytics:</strong> product events via PostHog.</li>
    <li><strong>Diagnostics:</strong> client errors via Sentry when enabled.</li>
    <li><strong>Billing:</strong> subscription status via Stripe; not full card numbers.</li>
  </ul>
  <p>We do not sell your personal data.</p>
  <nav aria-label="Site">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/terms">Terms</a>
  </nav>
</main>`,
  },
  {
    out: join(root, 'dist', 'terms', 'index.html'),
    title: 'Terms of Service | runcloud9',
    description:
      'Terms for using RunCloud9 during the invite alpha, including acceptable use, billing, and disclaimers.',
    url: `${SITE}/terms`,
    body: `<main>
  <h1>Terms of Service</h1>
  <p>Draft · invite alpha · last updated July 2026</p>
  <p>
    By using RunCloud9 during the invite alpha, you agree to these terms. If you do not agree,
    do not use the service.
  </p>
  <h2>Alpha service</h2>
  <p>
    RunCloud9 is experimental pre-release software. Features, limits, and availability may
    change without notice. There is no service-level agreement.
  </p>
  <h2>Acceptable use</h2>
  <p>
    Use the platform for lawful learning and architecture experimentation. Do not disrupt
    shared infrastructure or probe other users' sessions.
  </p>
  <nav aria-label="Site">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/privacy">Privacy</a>
  </nav>
</main>`,
  },
]

function applyPage(html, page) {
  let out = html
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${page.description}$2`,
  )
  out = out.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${page.title}$2`,
  )
  out = out.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${page.description}$2`,
  )
  out = out.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${page.url}$2`)
  out = out.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${page.title}$2`,
  )
  out = out.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${page.description}$2`,
  )
  out = out.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${page.url}$2`)
  // Vite moves the module script into <head>; body ends with #root then </body>.
  const shellBody = page.body.replace(/<main(\s|>)/, '<main data-seo-shell$1')
  out = out.replace(
    /(<div id="root">)[\s\S]*?(<\/div>\s*<\/body>)/,
    `$1\n      ${shellBody}\n    $2`,
  )
  return out
}

const template = readFileSync(distIndex, 'utf8')
for (const page of pages) {
  mkdirSync(dirname(page.out), { recursive: true })
  writeFileSync(page.out, applyPage(template, page))
  console.info(`[prerender] wrote ${page.out.replace(root + '\\', '').replace(root + '/', '')}`)
}
