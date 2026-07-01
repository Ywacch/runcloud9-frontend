export type { SteadyStateSummary } from './metricsUiContract'
export { parseSteadyState } from './metricsUiContract'

/** Client-path p99 from 5s Vegeta windows persisted at teardown. */
export interface ClientLatencyInterval {
  t: string
  p99Ms: number
  actualRps: number
}

/**
 * Parses `metrics_summary` from GET /deployments/{id} after teardown (includes
 * `session_history` downsampled snapshots from the API).
 */

export interface SessionSparklines {
  rps: number[]
  p99Ms: number[]
  errorRate: number[]
  cacheHitPct: number[]
  /** App-server per-second cache hit rate (Prometheus ~30s window). */
  cacheHitsPerSec: number[]
  cacheMissesPerSec: number[]
  /** DB query rate from `components.db`. */
  dbQueryRate: number[]
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

function finiteNonNegative(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= 0 ? v : null
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return null
}

/** Parse `metrics_summary.client_latency_history` (oldest → newest). */
export function parseClientLatencyHistory(raw: unknown): ClientLatencyInterval[] | null {
  if (!Array.isArray(raw)) return null
  const out: ClientLatencyInterval[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const p99Ms = finiteNonNegative(row.p99Ms)
    const actualRps = finiteNonNegative(row.actualRps)
    if (p99Ms == null || actualRps == null) continue
    const t = typeof row.t === 'string' ? row.t : ''
    out.push({ t, p99Ms, actualRps })
  }
  return out.length > 0 ? out : null
}

interface RawComponent {
  requestRate?: unknown
  p99Latency?: unknown
  errorRate?: unknown
  cacheHits?: unknown
  cacheMisses?: unknown
  cacheHitsLast9m?: unknown
  cacheMissesLast9m?: unknown
  dbQueryRate?: unknown
}

interface RawSnapshot {
  timestamp?: unknown
  components?: Record<string, RawComponent>
  loadgen?: { currentRps?: unknown; targetRps?: unknown }
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
  const cacheHitsPerSec: number[] = []
  const cacheMissesPerSec: number[] = []
  const dbQueryRate: number[] = []
  const markers: SessionSparklines['markers'] = []

  raw.forEach((snap, index) => {
    const s = snap as RawSnapshot
    const comp = s.components ?? {}
    const app = comp['app-server']
    const cache = comp['cache']
    const db = comp['db']
    const lg = s.loadgen
    const rq = num(app?.requestRate)
    const fromLg = num(lg?.targetRps ?? lg?.currentRps)
    rps.push(rq > 0 ? rq : fromLg)
    p99Ms.push(num(app?.p99Latency) * 1000)
    errorRate.push(num(app?.errorRate))
    cacheHitPctSeries.push(cacheHitPct(cache))
    cacheHitsPerSec.push(num(app?.cacheHits))
    cacheMissesPerSec.push(num(app?.cacheMisses))
    dbQueryRate.push(num(db?.dbQueryRate))

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
    cacheHitsPerSec,
    cacheMissesPerSec,
    dbQueryRate,
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
    cacheHitsPerSec: padSeriesForChart(s.cacheHitsPerSec),
    cacheMissesPerSec: padSeriesForChart(s.cacheMissesPerSec),
    dbQueryRate: padSeriesForChart(s.dbQueryRate),
    markers: s.markers,
  }
}

export interface StoragePeakSummary {
  readRate: number
  writeRate: number
  readLatencyMs: number
  writeLatencyMs: number
  utilizationPct: number
  errorRate: number
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
  storagePeaks: StoragePeakSummary
}> {
  if (!summary) return {}
  const out: Partial<{
    peakRps: number
    peakP99: number
    totalRequests: number
    cacheHitRate: number
    errorRate: number
    durationSeconds: number
    storagePeaks: StoragePeakSummary
  }> = {}
  if ('peak_rps' in summary) out.peakRps = num(summary.peak_rps)
  if ('peak_p99_ms' in summary) out.peakP99 = num(summary.peak_p99_ms)
  if ('total_requests' in summary)
    out.totalRequests = Math.round(num(summary.total_requests))
  if ('cache_hit_rate' in summary) out.cacheHitRate = num(summary.cache_hit_rate)
  if ('error_rate' in summary) out.errorRate = num(summary.error_rate)
  if ('actual_duration_seconds' in summary)
    out.durationSeconds = Math.round(num(summary.actual_duration_seconds))

  const hasStorage =
    'storage_read_rate' in summary ||
    'storage_write_rate' in summary ||
    'storage_utilization_pct' in summary
  if (hasStorage) {
    out.storagePeaks = {
      readRate: num(summary.storage_read_rate),
      writeRate: num(summary.storage_write_rate),
      readLatencyMs: num(summary.storage_read_latency_ms),
      writeLatencyMs: num(summary.storage_write_latency_ms),
      utilizationPct: num(summary.storage_utilization_pct),
      errorRate: num(summary.storage_error_rate),
    }
  }
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
