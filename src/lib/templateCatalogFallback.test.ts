import { describe, expect, it } from 'vitest'
import {
  FALLBACK_TEMPLATE_CATALOG,
  fallbackCatalogCoversFamilyPicker,
  fallbackTemplateById,
} from './templateCatalogFallback'

describe('templateCatalogFallback', () => {
  it('ships the four free embedded templates', () => {
    expect(FALLBACK_TEMPLATE_CATALOG.map((row) => row.id).sort()).toEqual([
      'ecommerce',
      'social-feed',
      'social-feed-pull',
      'url-shortener',
    ])
  })

  it('includes variations, presets, and storytelling for picker + canvas', () => {
    const url = fallbackTemplateById('url-shortener')
    expect(url?.variations?.length).toBeGreaterThan(0)
    expect(url?.preset?.nodes.length).toBeGreaterThan(0)
    expect(url?.storytelling?.roles).toBeTruthy()
    expect(url?.simulatable).toBe(true)
    expect(url?.deployable).toBe(true)
  })

  it('covers every template family picker slot', () => {
    expect(fallbackCatalogCoversFamilyPicker()).toBe(true)
  })
})
