/** Y-axis domain with headroom for line charts (Railway-style). */
export function computeYDomain(values: number[]): { min: number; max: number } {
  const valid = values.filter((n) => Number.isFinite(n))
  if (valid.length === 0) return { min: 0, max: 1 }

  let min = Math.min(...valid)
  let max = Math.max(...valid)

  if (min === max) {
    if (min === 0) return { min: 0, max: 1 }
    const pad = Math.abs(min) * 0.15 || 1
    return { min: Math.max(0, min - pad), max: max + pad }
  }

  const span = max - min
  const pad = span * 0.1
  return {
    min: min >= 0 ? Math.max(0, min - pad) : min - pad,
    max: max + pad,
  }
}

/** Top-to-bottom tick values for the Y axis (count ≥ 2). */
export function yAxisTicks(min: number, max: number, count = 4): number[] {
  const n = Math.max(2, count)
  if (max === min) return Array.from({ length: n }, () => max)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    out.push(max - (i / (n - 1)) * (max - min))
  }
  return out
}

/** Compact axis label (K / M suffixes like Railway dashboards). */
export function formatChartTick(v: number, unit?: string): string {
  if (!Number.isFinite(v)) return ''
  const abs = Math.abs(v)
  let s: string
  if (abs >= 1_000_000) s = `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  else if (abs >= 10_000) s = `${Math.round(v / 1000)}K`
  else if (abs >= 1000) s = `${(v / 1000).toFixed(1)}K`
  else if (abs >= 100) s = Math.round(v).toLocaleString()
  else if (abs >= 10) s = Math.round(v).toString()
  else if (abs >= 1) s = v.toFixed(1)
  else if (abs === 0) s = '0'
  else s = v.toFixed(2)
  return unit ? `${s} ${unit}` : s
}

export function flattenSeriesValues(
  series: Array<{ data: number[] }>,
  fallback: number[] = [],
): number[] {
  const out: number[] = []
  for (const s of series) out.push(...s.data)
  if (out.length === 0 && fallback.length) out.push(...fallback)
  return out.filter((n) => Number.isFinite(n))
}
