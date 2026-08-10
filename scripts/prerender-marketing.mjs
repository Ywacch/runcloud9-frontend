/**
 * After `vite build`, write static HTML shells for public marketing routes.
 * Vercel serves these files before the SPA rewrite, so crawlers see real copy.
 * Titles/descriptions come from src/lib/publicSeoPages.json (shared with the SPA).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distIndex = join(root, 'dist', 'index.html')
const seo = JSON.parse(
  readFileSync(join(root, 'src', 'lib', 'publicSeoPages.json'), 'utf8'),
)

const SITE = seo.siteOrigin

function metaFor(path) {
  if (path === '/') return seo.home
  const page = seo.pages.find((p) => p.path === path)
  if (!page) throw new Error(`Missing SEO meta for ${path}`)
  return page
}

const pageBodies = {
  '/about': `<main>
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
    <a href="/pricing">Pricing</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </nav>
</main>`,
  '/pricing': `<main>
  <h1>Subscription plans</h1>
  <p>
    Design on a canvas, deploy to real Kubernetes, and watch the system under load.
    Invite-only alpha.
  </p>
  <h2>Explorer</h2>
  <p>$0 forever. Deploy free templates on the Explorer-runnable design.</p>
  <h2>Engineer</h2>
  <p>
    Load balancers, queues, workers, proxy cache strategies, all templates, and higher
    session quotas. Price shown at checkout.
  </p>
  <p><a href="/login">Sign in</a> to upgrade or <a href="/canvas">open the canvas</a>.</p>
  <nav aria-label="Site">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </nav>
</main>`,
  '/privacy': `<main>
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
    <a href="/pricing">Pricing</a>
    <a href="/terms">Terms</a>
  </nav>
</main>`,
  '/terms': `<main>
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
    <a href="/pricing">Pricing</a>
    <a href="/privacy">Privacy</a>
  </nav>
</main>`,
}

const pages = Object.entries(pageBodies).map(([path, body]) => {
  const meta = metaFor(path)
  return {
    out: join(root, 'dist', path.slice(1), 'index.html'),
    title: meta.title,
    description: meta.description,
    url: path === '/' ? `${SITE}/` : `${SITE}${path}`,
    body,
  }
})

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
