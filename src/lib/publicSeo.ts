import seoPages from './publicSeoPages.json'

export type PublicSeoPage = {
  path: string
  title: string
  description: string
}

export const SITE_ORIGIN = seoPages.siteOrigin
export const SITE_NAME = seoPages.siteName
export const ORGANIZATION_NAME = seoPages.organizationName
export const SITE_LOGO_PATH = '/logo.png'

export const HOME_SEO: PublicSeoPage = seoPages.home

export const PUBLIC_SEO_PAGES: PublicSeoPage[] = [
  seoPages.home,
  ...seoPages.pages,
]

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : '/'
}

/** Meta for public marketing URLs; app routes fall back to site name only. */
export function resolvePublicSeo(pathname: string): PublicSeoPage {
  const path = normalizePath(pathname)
  const match = PUBLIC_SEO_PAGES.find((page) => page.path === path)
  if (match) return match
  return {
    path,
    title: SITE_NAME,
    description: HOME_SEO.description,
  }
}

export function absoluteUrl(path: string): string {
  if (path === '/') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${path}`
}

/** Organization + WebSite JSON-LD for sitelink / brand SERP eligibility. */
export function siteJsonLdGraph(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: ORGANIZATION_NAME,
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}${SITE_LOGO_PATH}`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
        description: HOME_SEO.description,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        inLanguage: 'en',
      },
    ],
  }
}
