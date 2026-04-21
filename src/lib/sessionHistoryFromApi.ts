/**
 * Parses `metrics_summary` from GET /deployments/{id} after teardown (includes
 * `session_history` downsampled snapshots from the API).
 */

export interface SessionSparklines {
  rps: number[]
  p99Ms: number[]
  errorRate: number[]
  cacheHitPct: number[]
  markers: Array<{ index: number; type: string; title: string }>
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

interface RawComponent {
  requestRate?: unknown
  p99Latency?: unknown
  errorRate?: unknown
  cacheHitsLast9m?: unknown
  cacheMissesLast9m?: unknown
}

interface RawSnapshot {
  timestamp?: unknown
  components?: Record<string, RawComponent>
  loadgen?: { currentRps?: unknown }
  events?: Array<{ type?: string; title?: string; description?: string }>
}

function cacheHitPct(c: RawComponent | undefined): number {
  if (!c) return 0
  const hits = num(c.cacheHitsLast9m)
  const misses = num(c.cacheMissesLast9m)
  const t = hits + misses
  if (t <= 0) return 0
  return (hits / t) * 100
}

/** Build per-tick series + event markers from downsampled deployment metrics. */
export function parseSessionHistory(
  raw: unknown
): SessionSparklines | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  const rps: number[] = []
  const p99Ms: number[] = []
  const errorRate: number[] = []
  const cacheHitPctSeries: number[] = []
  const markers: SessionSparklines['markers'] = []

  raw.forEach((snap, index) => {
    const s = snap as RawSnapshot
    const comp = s.components ?? {}
    const app = comp['app-server']
    const cache = comp['cache']
    const lg = s.loadgen
    const rq = num(app?.requestRate)
    const fromLg = num(lg?.currentRps)
    rps.push(rq > 0 ? rq : fromLg)
    p99Ms.push(num(app?.p99Latency) * 1000)
    errorRate.push(num(app?.errorRate))
    cacheHitPctSeries.push(cacheHitPct(cache))

    const ev = s.events
    if (Array.isArray(ev) && ev.length > 0) {
      const e0 = ev[0]
      const title =
        (e0?.title && String(e0.title).trim()) ||
        (e0?.description && String(e0.description).trim()) ||
        'event'
      markers.push({
        index,
        type: String(e0?.type ?? 'action'),
        title,
      })
    }
  })

  return {
    rps,
    p99Ms,
    errorRate,
    cacheHitPct: cacheHitPctSeries,
    markers,
  }
}

function padSeriesForChart(a: number[]): number[] {
  if (a.length >= 2) return a
  if (a.length === 1) return [a[0], a[0]]
  return []
}

/** Ensure each series is drawable by SparkLine (≥2 points). */
export function normalizeSparklines(s: SessionSparklines): SessionSparklines {
  return {
    rps: padSeriesForChart(s.rps),
    p99Ms: padSeriesForChart(s.p99Ms),
    errorRate: padSeriesForChart(s.errorRate),
    cacheHitPct: padSeriesForChart(s.cacheHitPct),
    markers: s.markers,
  }
}

/** Extract numeric peak fields stored in metrics_summary JSONB. */
export function parsePeakFieldsFromMetricsSummary(
  summary: Record<string, unknown> | undefined
): Partial<{
  peakRps: number
  peakP99: number
  totalRequests: number
  cacheHitRate: number
  errorRate: number
  durationSeconds: number
}> {
  if (!summary) return {}
  const out: Partial<{
    peakRps: number
    peakP99: number
    totalRequests: number
    cacheHitRate: number
    errorRate: number
    durationSeconds: number
  }> = {}
  if ('peak_rps' in summary) out.peakRps = num(summary.peak_rps)
  if ('peak_p99_ms' in summary) out.peakP99 = num(summary.peak_p99_ms)
  if ('total_requests' in summary)
    out.totalRequests = Math.round(num(summary.total_requests))
  if ('cache_hit_rate' in summary) out.cacheHitRate = num(summary.cache_hit_rate)
  if ('error_rate' in summary) out.errorRate = num(summary.error_rate)
  if ('actual_duration_seconds' in summary)
    out.durationSeconds = Math.round(num(summary.actual_duration_seconds))
  return out
}

/** Merge client summary with API peaks; API wins for keys present on `summary`. */
export function mergePeakScalars(
  base: {
    peakRps: number
    peakP99: number
    totalRequests: number
    cacheHitRate: number
    errorRate: number
  },
  summary: Record<string, unknown> | undefined
): typeof base {
  const p = parsePeakFieldsFromMetricsSummary(summary)
  return {
    peakRps: 'peak_rps' in (summary ?? {}) ? (p.peakRps ?? 0) : base.peakRps,
    peakP99: 'peak_p99_ms' in (summary ?? {}) ? (p.peakP99 ?? 0) : base.peakP99,
    totalRequests:
      'total_requests' in (summary ?? {}) ? (p.totalRequests ?? 0) : base.totalRequests,
    cacheHitRate:
      'cache_hit_rate' in (summary ?? {}) ? (p.cacheHitRate ?? 0) : base.cacheHitRate,
    errorRate: 'error_rate' in (summary ?? {}) ? (p.errorRate ?? 0) : base.errorRate,
  }
}
