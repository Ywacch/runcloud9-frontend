/**
 * Logo assets for engine face badges.
 *
 * Prefer replacing these with official marks from https://svglogos.dev/
 * (vendored into this folder, not fetched at runtime). See ATTRIBUTION.md.
 *
 * Until then: compact geometric stand-ins sized for isometric top-face badges.
 */

export const LOGO_SVG: Record<string, string> = {
  postgresql: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#336791"><circle cx="12" cy="12" r="10"/><text x="12" y="16" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#fff" font-weight="700">Pg</text></svg>`,
  mongodb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#47A248"><path d="M12 2c0 0-4 5-4 11 0 3 1.5 5 4 9 2.5-4 4-6 4-9 0-6-4-11-4-11z"/><path fill="#3F3E42" d="M12 2v20" stroke="#3F3E42" stroke-width="1.2"/></svg>`,
  memcached: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="4" rx="1" fill="#2B2B2B"/><rect x="3" y="10" width="18" height="4" rx="1" fill="#555"/><rect x="3" y="15" width="18" height="4" rx="1" fill="#2B2B2B"/><text x="12" y="13.5" text-anchor="middle" font-size="5" fill="#fff" font-family="sans-serif" font-weight="700">Mc</text></svg>`,
  kafka: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#231F20"><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="M9 8.5l2.5 6M15 8.5l-2.5 6M9.5 7h5" stroke="#231F20" stroke-width="1.5" fill="none"/></svg>`,
  nats: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#27AAE1"/><text x="12" y="16" text-anchor="middle" font-size="8" fill="#fff" font-family="sans-serif" font-weight="700">N</text></svg>`,
}

export function logoDataUrl(logoId: string): string | null {
  const raw = LOGO_SVG[logoId]
  if (!raw) return null
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`
}
