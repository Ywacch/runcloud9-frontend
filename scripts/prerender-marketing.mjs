/**
 * After `vite build`, write static HTML shells for public marketing routes.
 * Vercel serves these files before the SPA rewrite, so crawlers see real copy.
 * Titles/descriptions come from src/lib/publicSeoPages.json (shared with the SPA).
 * Legal bodies come from src/content/publicLegalContent.json (shared with the SPA).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderLegalDocumentHtml } from './render-legal-seo-html.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distIndex = join(root, 'dist', 'index.html')
const seo = JSON.parse(
  readFileSync(join(root, 'src', 'lib', 'publicSeoPages.json'), 'utf8'),
)
const legalContent = JSON.parse(
  readFileSync(join(root, 'src', 'content', 'publicLegalContent.json'), 'utf8'),
)

const SITE = seo.siteOrigin

function metaFor(path) {
  if (path === '/') return seo.home
  const page = seo.pages.find((p) => p.path === path)
  if (!page) throw new Error(`Missing SEO meta for ${path}`)
  return page
}

const siteNav = `
  <nav aria-label="Site">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/login">Sign in</a>
  </nav>`

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
  <p><a href="/canvas">Open the canvas</a> or <a href="/login">sign in</a> to deploy.</p>
  ${siteNav}
</main>`,
  '/privacy': `<main>
  ${renderLegalDocumentHtml(legalContent.privacy)}
  ${siteNav}
</main>`,
  '/terms': `<main>
  ${renderLegalDocumentHtml(legalContent.terms)}
  ${siteNav}
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
