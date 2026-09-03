import { describe, expect, it } from 'vitest'
import {
  absoluteUrl,
  HOME_SEO,
  PUBLIC_SEO_PAGES,
  resolvePublicSeo,
  siteJsonLdGraph,
  SITE_NAME,
  SITE_ORIGIN,
} from './publicSeo'

describe('publicSeo', () => {
  it('lists distinct public pages for sitelink targets', () => {
    const paths = PUBLIC_SEO_PAGES.map((p) => p.path)
    expect(paths).toEqual(
      expect.arrayContaining(['/', '/about', '/privacy', '/terms']),
    )
    expect(paths).not.toContain('/pricing')
    expect(new Set(paths).size).toBe(paths.length)
    for (const page of PUBLIC_SEO_PAGES) {
      expect(page.title.length).toBeGreaterThan(8)
      expect(page.description.length).toBeGreaterThan(40)
      expect(page.title).toContain(SITE_NAME)
    }
  })

  it('resolves marketing paths and falls back for app routes', () => {
    expect(resolvePublicSeo('/about').path).toBe('/about')
    expect(resolvePublicSeo('/about/').title).toContain('About')
    expect(resolvePublicSeo('/dashboard').title).toBe(SITE_NAME)
    expect(resolvePublicSeo('/').title).toBe(HOME_SEO.title)
  })

  it('builds absolute URLs and JSON-LD graph', () => {
    expect(absoluteUrl('/')).toBe(`${SITE_ORIGIN}/`)
    expect(absoluteUrl('/about')).toBe(`${SITE_ORIGIN}/about`)
    const graph = siteJsonLdGraph()
    expect(graph['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'Organization' }),
        expect.objectContaining({ '@type': 'WebSite' }),
      ]),
    )
  })
})
