/**
 * Inline external <image> hrefs as data URIs so the SVG is self-contained.
 */

export function mimeForAssetUrl(url: string): string {
  const path = url.split('?')[0]?.toLowerCase() ?? ''
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}

export function bytesToDataUri(bytes: ArrayBuffer, mime: string): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk))
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(view).toString('base64')
  return `data:${mime};base64,${b64}`
}

export type FetchBytes = (url: string) => Promise<ArrayBuffer>

export async function fetchAssetAsDataUri(
  href: string,
  fetchBytes: FetchBytes = defaultFetchBytes,
): Promise<string> {
  if (href.startsWith('data:')) return href
  const bytes = await fetchBytes(href)
  return bytesToDataUri(bytes, mimeForAssetUrl(href))
}

async function defaultFetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch asset (${res.status}): ${url}`)
  }
  return res.arrayBuffer()
}
