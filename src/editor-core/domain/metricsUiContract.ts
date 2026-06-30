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

/** Per-pod row from `app-server.replicas[]` or `lb.backendPods[]`. */
export interface PodReplicaMetrics {
  name: string
  ready: boolean
  requestRate: number
  /** Milliseconds (WS sends seconds). */
  p99LatencyMs: number
  /** Rolling 9m request count (Prometheus window). */
  totalRequests: number
  /** CPU cores in use. */
  cpuUsage: number
  errorRate: number
  /** Optional per-pod memory (bytes); omitted in v1 contract until backend adds it. */
  memoryBytes: number
}

export interface BackendReplicaStatus {
  desired: number
  ready: number
}

/** Engine-native store signals from WS `storageIo` (metrics-ui-contract). */
export interface StorageIoMetrics {
  readRate: number
  writeRate: number
  unit: string
  readLabel?: string
  writeLabel?: string
  scope?: string
  footnote?: string
  /** Structural access pattern (planned on wire) — not a live counter. */
  pattern?: string
  patternNote?: string
  /** Reserved — not populated until Phase 2.5; use `dbQueryLatency` on db. */
  readLatency: number
  writeLatency: number
  bytesUsed: number
  bytesLimit: number
  /** Store failures per second (not HTTP 5xx). */
  errorRate: number
  source: string
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s || undefined
}

export function parseStorageIo(raw: unknown): StorageIoMetrics | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    readRate: num(r.readRate),
    writeRate: num(r.writeRate),
    unit: typeof r.unit === 'string' ? r.unit.trim() : '',
    readLabel: str(r.readLabel),
    writeLabel: str(r.writeLabel),
    scope: str(r.scope),
    footnote: str(r.footnote),
    pattern: str(r.pattern),
    patternNote: str(r.patternNote),
    readLatency: num(r.readLatency),
    writeLatency: num(r.writeLatency),
    bytesUsed: num(r.bytesUsed),
    bytesLimit: num(r.bytesLimit),
    errorRate: num(r.errorRate),
    source: typeof r.source === 'string' ? r.source.trim() : '',
  }
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

export function parseRecentLatenciesMs(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0)
}

export function parsePodReplicas(raw: unknown): PodReplicaMetrics[] {
  if (!Array.isArray(raw)) return []
  const out: PodReplicaMetrics[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (!name) continue
    out.push({
      name,
      ready: Boolean(r.ready),
      requestRate: num(r.requestRate),
      p99LatencyMs: num(r.p99Latency) * 1000,
      totalRequests: Math.round(num(r.totalRequests)),
      cpuUsage: num(r.cpuUsage),
      errorRate: num(r.errorRate),
      memoryBytes: num(r.memoryBytes ?? r.memoryUsage),
    })
  }
  return out
}

export function parseBackendReplicas(raw: unknown): BackendReplicaStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const desired = Math.round(num(r.desired))
  const ready = Math.round(num(r.ready))
  if (desired <= 0 && ready <= 0) return null
  return { desired, ready }
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
