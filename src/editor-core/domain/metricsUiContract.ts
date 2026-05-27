/**
 * Parsers aligned with ganymede `metrics-ui-contract.md` (WS + metrics_summary).
 */

export interface LoadgenIntervalBucket {
  t: string
  p99Ms: number
  actualRps: number
}

export interface SteadyStateSummary {
  steadyP99Ms: number
  steadyRps: number
  steadyDbQueryRate: number
  steadyCacheHitRate: number
  snapshotCount: number
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function parseLoadgenIntervals(raw: unknown): LoadgenIntervalBucket[] {
  if (!Array.isArray(raw)) return []
  const out: LoadgenIntervalBucket[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    out.push({
      t: typeof r.t === 'string' ? r.t : '',
      p99Ms: num(r.p99Ms),
      actualRps: num(r.actualRps),
    })
  }
  return out.slice(-12)
}

export function parseSteadyState(raw: unknown): SteadyStateSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const snapshotCount = Math.round(num(s.snapshot_count))
  if (snapshotCount <= 0 && num(s.steady_p99_ms) <= 0 && num(s.steady_rps) <= 0) {
    return null
  }
  return {
    steadyP99Ms: num(s.steady_p99_ms),
    steadyRps: num(s.steady_rps),
    steadyDbQueryRate: num(s.steady_db_query_rate),
    steadyCacheHitRate: num(s.steady_cache_hit_rate),
    snapshotCount,
  }
}

export interface WsComponentsSlice {
  app?: {
    requestRate?: number
    p99Latency?: number
    cacheHits?: number
    cacheMisses?: number
  }
  db?: { dbQueryRate?: number }
}

/** One WS tick for system teaching charts (2s cadence). */
export function sampleFromWsPayload(
  timestamp: string | undefined,
  components: Record<string, unknown> | undefined,
): {
  t: number
  appP99Ms: number
  appRps: number
  dbQueryRate: number
  cacheHits: number
  cacheMisses: number
} | null {
  const comp = components ?? {}
  const app = comp['app-server'] as Record<string, unknown> | undefined
  if (!app) return null
  const t = timestamp ? Date.parse(timestamp) : Date.now()
  if (!Number.isFinite(t)) return null
  const db = comp['db'] as Record<string, unknown> | undefined
  return {
    t,
    appP99Ms: num(app.p99Latency) * 1000,
    appRps: num(app.requestRate),
    dbQueryRate: num(db?.dbQueryRate),
    cacheHits: num(app.cacheHits),
    cacheMisses: num(app.cacheMisses),
  }
}
