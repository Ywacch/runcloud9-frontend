import { describe, expect, it } from 'vitest'
import { renderLegalDocumentHtml } from './renderLegalSeoHtml'
import legalContent from '../content/publicLegalContent.json'
import seoPages from './publicSeoPages.json'

describe('public legal SEO content', () => {
  it('renders full terms HTML for crawlers', () => {
    const html = renderLegalDocumentHtml(legalContent.terms)
    expect(html).toContain('Terms of Service')
    expect(html).toContain('operator of RunCloud9')
    expect(html).toContain('Paid plans may be offered later')
    expect(html).toContain('Indemnification')
    expect(html).not.toContain('Stop subscription')
    expect(html).not.toContain('Stripe')
  })

  it('renders full privacy HTML for crawlers', () => {
    const html = renderLegalDocumentHtml(legalContent.privacy)
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('What we collect')
    expect(html).toContain('Processors and sharing')
    expect(html).toContain('Google or GitHub')
    expect(html).toContain('Discord')
    expect(html).not.toContain('Stripe')
    expect(html).not.toContain('Engineer subscriptions')
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
