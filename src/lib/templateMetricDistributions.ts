/** Latency quantile suffixes on neutral `templateMetrics` keys (values in seconds). */
const QUANTILE_SUFFIXES = ['_p50', '_p95', '_p99'] as const

export type QuantileSuffix = (typeof QUANTILE_SUFFIXES)[number]

export interface TemplateMetricDistribution {
  /** Key prefix before `_p50` / `_rate`, e.g. `feed.pull`. */
  prefix: string
  /** Human label derived from the prefix, e.g. `Feed pull`. */
  label: string
  /** Milliseconds (converted from backend seconds). */
  p50Ms?: number
  p95Ms?: number
  p99Ms?: number
  /** Throughput from `<prefix>_rate` when present. */
  rate?: number
}

function parseQuantileKey(
  key: string,
): { prefix: string; quantile: 'p50' | 'p95' | 'p99' } | null {
  for (const suffix of QUANTILE_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return {
        prefix: key.slice(0, -suffix.length),
        quantile: suffix.slice(1) as 'p50' | 'p95' | 'p99',
      }
    }
  }
  return null
}

/** True when the key is auto-derived by convention (quantile or `*_rate`). */
export function isConventionMetricKey(key: string): boolean {
  if (parseQuantileKey(key) != null) return true
  return key.endsWith('_rate') && !/_p\d+$/.test(key)
}

/** Derive a short label from a neutral dot key prefix (`feed.pull` → `Feed pull`). */
export function humanizeMetricPrefix(prefix: string): string {
  const words = prefix
    .split('.')
    .flatMap((part) => part.split('_'))
    .filter(Boolean)
    .join(' ')
  if (!words) return prefix
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

function secondsToMs(seconds: number): number {
  return seconds * 1000
}

/**
 * Group `templateMetrics` keys by convention:
 * - `<prefix>_p50|p95|p99` → latency quantiles on `<prefix>`
 * - `<prefix>_rate` → throughput on `<prefix>`
 *
 * New templates only need YAML keys; no frontend whitelist per template.
 */
export function groupTemplateMetricDistributions(
  templateMetrics: Record<string, number>,
): TemplateMetricDistribution[] {
  const groups = new Map<string, TemplateMetricDistribution>()

  const ensure = (prefix: string): TemplateMetricDistribution => {
    let g = groups.get(prefix)
    if (!g) {
      g = { prefix, label: humanizeMetricPrefix(prefix) }
      groups.set(prefix, g)
    }
    return g
  }

  for (const [key, raw] of Object.entries(templateMetrics)) {
    if (raw == null || !Number.isFinite(raw)) continue

    const quantile = parseQuantileKey(key)
    if (quantile) {
      const g = ensure(quantile.prefix)
      const ms = secondsToMs(raw)
      if (quantile.quantile === 'p50') g.p50Ms = ms
      else if (quantile.quantile === 'p95') g.p95Ms = ms
      else g.p99Ms = ms
      continue
    }

    if (key.endsWith('_rate')) {
      const prefix = key.slice(0, -'_rate'.length)
      if (!prefix) continue
      ensure(prefix).rate = raw
    }
  }

  return Array.from(groups.values())
    .filter(
      (g) =>
        (g.p50Ms != null && g.p50Ms > 0) ||
        (g.p95Ms != null && g.p95Ms > 0) ||
        (g.p99Ms != null && g.p99Ms > 0) ||
        (g.rate != null && g.rate > 0),
    )
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
}

export function distributionHasLatency(d: TemplateMetricDistribution): boolean {
  return (
    (d.p50Ms != null && d.p50Ms > 0) ||
    (d.p95Ms != null && d.p95Ms > 0) ||
    (d.p99Ms != null && d.p99Ms > 0)
  )
}
