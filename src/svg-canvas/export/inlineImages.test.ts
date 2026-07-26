import { describe, expect, it } from 'vitest'
import {
  bytesToDataUri,
  fetchAssetAsDataUri,
  mimeForAssetUrl,
} from './inlineImages'

describe('inlineImages', () => {
  it('guesses mime from asset extension', () => {
    expect(mimeForAssetUrl('/assets/logo.svg')).toBe('image/svg+xml')
    expect(mimeForAssetUrl('/a/b.png?v=1')).toBe('image/png')
    expect(mimeForAssetUrl('/x.jpg')).toBe('image/jpeg')
  })

  it('builds a data URI from bytes', () => {
    const bytes = new TextEncoder().encode('hi').buffer
    const uri = bytesToDataUri(bytes, 'image/svg+xml')
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('passes through existing data URIs', async () => {
    const data = 'data:image/png;base64,abc'
    await expect(fetchAssetAsDataUri(data)).resolves.toBe(data)
  })

  it('fetches and inlines remote hrefs via injectible fetch', async () => {
    const payload = new TextEncoder().encode('<svg/>').buffer
    const uri = await fetchAssetAsDataUri('/logo.svg', async (url) => {
      expect(url).toBe('/logo.svg')
      return payload
    })
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/)
  })
})
