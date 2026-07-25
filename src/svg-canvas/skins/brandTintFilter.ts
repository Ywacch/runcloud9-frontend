import type { BrandTint } from './engineSkins'

export type Rgb = { r: number; g: number; b: number }

/** Parse `#rgb` / `#rrggbb` into 0–1 channel floats. */
export function parseHexRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '')
  let full = raw
  if (raw.length === 3) {
    full = raw
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  }
}

/** True when tint faces are near-neutral greys (skip filter). */
export function isNearGreyscale(tint: BrandTint, maxChroma = 0.06): boolean {
  for (const hex of [tint.top, tint.left, tint.right]) {
    const rgb = parseHexRgb(hex)
    if (!rgb) return false
    const chroma = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)
    if (chroma > maxChroma) return false
  }
  return true
}

/**
 * feColorMatrix values that map greyscale luminance → `top` accent.
 * Returns null when tint is missing or near-greyscale.
 */
export function tintColorMatrixValues(tint: BrandTint | null | undefined): string | null {
  if (!tint || isNearGreyscale(tint)) return null
  const rgb = parseHexRgb(tint.top)
  if (!rgb) return null
  const { r, g, b } = rgb
  // Greyscale source: R≈G≈B=L → output (rL, gL, bL).
  return [
    `${r} 0 0 0 0`,
    `0 ${g} 0 0 0`,
    `0 0 ${b} 0 0`,
    `0 0 0 1 0`,
  ].join(' ')
}
