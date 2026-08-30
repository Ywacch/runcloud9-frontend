import { describe, expect, it } from 'vitest'
import { renderLegalDocumentHtml } from './renderLegalSeoHtml'
import legalContent from '../content/publicLegalContent.json'
import seoPages from './publicSeoPages.json'

describe('public legal SEO content', () => {
  it('renders full terms HTML for crawlers', () => {
    const html = renderLegalDocumentHtml(legalContent.terms)
    expect(html).toContain('Terms of Service')
    expect(html).toContain('Stop subscription')
    expect(html).toContain('Cancel &amp; refund')
    expect(html).not.toContain('invite alpha')
  })

  it('renders full privacy HTML for crawlers', () => {
    const html = renderLegalDocumentHtml(legalContent.privacy)
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('What we collect')
    expect(html).toContain('Processors')
    expect(html).not.toContain('invite alpha')
  })

  it('keeps marketing SEO meta free of invite-only alpha copy', () => {
    const descriptions = [
      seoPages.home.description,
      ...seoPages.pages.map((page) => page.description),
    ]
    for (const description of descriptions) {
      expect(description.toLowerCase()).not.toContain('invite-only')
      expect(description.toLowerCase()).not.toContain('invite alpha')
    }
  })
})
