/** Per-signal-group freshness — mirrors ganymede pkg/metrics/freshness.go. */

export const FRESHNESS_TIERS = [
  'direct',
  'rate',
  'metrics_api',
  'estimated',
] as const

export type FreshnessTier = (typeof FRESHNESS_TIERS)[number] | 'unknown'

export const SIGNAL_GROUP_KEYS = [
  'throughput',
  'containerCpu',
  'containerMem',
  'connections',
  'queue',
] as const

export type SignalGroupKey = (typeof SIGNAL_GROUP_KEYS)[number]

export interface SignalFreshness {
  tier: FreshnessTier
  nominalLagSeconds: number
  source?: string
}

export type ComponentFreshness = Partial<Record<SignalGroupKey, SignalFreshness>>

function parseTier(raw: unknown): FreshnessTier {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if ((FRESHNESS_TIERS as readonly string[]).includes(t)) {
    return t as (typeof FRESHNESS_TIERS)[number]
  }
  return 'unknown'
}

function numLag(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Tolerant parser: missing/malformed → undefined; unknown tiers → `unknown`. */
export function parseComponentFreshness(raw: unknown): ComponentFreshness | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const src = raw as Record<string, unknown>
  const out: ComponentFreshness = {}
  let any = false
  for (const key of SIGNAL_GROUP_KEYS) {
    const row = src[key]
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const signal: SignalFreshness = {
      tier: parseTier(r.tier),
      nominalLagSeconds: numLag(r.nominalLagSeconds),
    }
    const source = typeof r.source === 'string' ? r.source.trim() : ''
    if (source) signal.source = source
    out[key] = signal
    any = true
  }
  return any ? out : undefined
}

/** Short UI copy for laggy / estimated container signals. */
export function containerFreshnessHint(
  signal: SignalFreshness | undefined,
): string | undefined {
  if (!signal) return undefined
  switch (signal.tier) {
    case 'metrics_api':
      return 'Delayed ~15–60s. Kubernetes Metrics API (same source as kubectl top).'
    case 'estimated':
      return 'Allocated, not measured. Kube request/limit placeholder.'
    case 'rate':
      return 'Prometheus scrape + rate window (~10–15s behind).'
    case 'direct':
      return 'Live poll (~2s behind).'
    default:
      return undefined
  }
}
