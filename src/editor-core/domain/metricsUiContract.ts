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

/** Per-pod K8s status from `components.<key>.runtimeHealth.pods[]`. */
export interface PodRuntimeHealth {
  name: string
  ready: boolean
  restartCount: number
  waitingReason?: string
  lastTerminationReason?: string
  exitCode?: number
}

/** Live pod readiness/restart summary from WS `runtimeHealth`. */
export interface RuntimeHealthSummary {
  unreadyCount: number
  restarting: boolean
  pods: PodRuntimeHealth[]
}

/** Metric snapshot attached to `pod_restart` / `pod_oom` events. */
export interface CrashContext {
  pod?: string
  terminationReason?: string
  waitingReason?: string
  exitCode?: number
  cpuPercent?: number
  memPercent?: number
  memoryLimitBytes?: number
  errorRate?: number
  activeConnections?: number
  redisRejectedRate?: number
  redisOpsPerSec?: number
  queueDepth?: number
}

/** Per-process metrics for layered cache (`components.cache.layers[]`). */
export interface ComponentLayerMetrics {
  id: string
  role: string
  engine: string
  cpuUsage: number
  memoryBytes: number
  cpuLimit: number
  memoryLimit: number
  cpuIsEstimated: boolean
  memIsEstimated: boolean
  cpuSource?: 'cadvisor' | 'metrics_api' | 'requests'
  memSource?: 'cadvisor' | 'metrics_api' | 'requests'
  redisOpsPerSec?: number
  redisKeyspaceHits?: number
  redisKeyspaceMisses?: number
  redisRejectedRate?: number
  restartCount?: number
}

/** Engine-native store signals from WS `storageIo` (metrics-ui-contract). */
export interface StorageIoMetrics {
  readRate: number
  writeRate: number
  /** Prometheus increase(...[9m]) — optional until backend ships. */
  readTotal9m?: number
  writeTotal9m?: number
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
    readTotal9m: num(r.readTotal9m) || undefined,
    writeTotal9m: num(r.writeTotal9m) || undefined,
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

export function parseStatusCodes(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const code = String(key).trim()
    if (!code) continue
    const n = num(value)
    if (n < 0) continue
    out[code] = n
  }
  return out
}

export function parseResourceUsageSource(
  raw: unknown,
): 'cadvisor' | 'metrics_api' | 'requests' | undefined {
  if (raw === 'cadvisor' || raw === 'metrics_api' || raw === 'requests') return raw
  return undefined
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

export function parseRuntimeHealth(raw: unknown): RuntimeHealthSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const podsRaw = Array.isArray(r.pods) ? r.pods : []
  const pods: PodRuntimeHealth[] = []
  for (const row of podsRaw) {
    if (!row || typeof row !== 'object') continue
    const p = row as Record<string, unknown>
    const name = typeof p.name === 'string' ? p.name.trim() : ''
    if (!name) continue
    const exitCode = Math.round(num(p.exitCode))
    pods.push({
      name,
      ready: Boolean(p.ready),
      restartCount: Math.round(num(p.restartCount)),
      waitingReason: str(p.waitingReason),
      lastTerminationReason: str(p.lastTerminationReason),
      exitCode: exitCode !== 0 ? exitCode : undefined,
    })
  }
  const unreadyCount = Math.round(num(r.unreadyCount))
  const restarting = Boolean(r.restarting)
  if (!restarting && unreadyCount <= 0 && pods.length === 0) return null
  return { unreadyCount, restarting, pods }
}

export function parseCrashContext(raw: unknown): CrashContext | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const ctx: CrashContext = {
    pod: str(r.pod),
    terminationReason: str(r.terminationReason),
    waitingReason: str(r.waitingReason),
    exitCode: Math.round(num(r.exitCode)) || undefined,
    cpuPercent: num(r.cpuPercent) || undefined,
    memPercent: num(r.memPercent) || undefined,
    memoryLimitBytes: Math.round(num(r.memoryLimitBytes)) || undefined,
    errorRate: num(r.errorRate) || undefined,
    activeConnections: num(r.activeConnections) || undefined,
    redisRejectedRate: num(r.redisRejectedRate) || undefined,
    redisOpsPerSec: num(r.redisOpsPerSec) || undefined,
    queueDepth: num(r.queueDepth) || undefined,
  }
  const hasData = Object.values(ctx).some(
    (v) => v !== undefined && v !== '' && v !== 0,
  )
  return hasData ? ctx : null
}

const LAYER_ROLE_ORDER: Record<string, number> = {
  'backing-store': 0,
  sidecar: 1,
}

export function layerResourcePercents(layer: ComponentLayerMetrics): {
  cpuPercent: number
  memPercent: number
} {
  const cpuLimit = layer.cpuLimit
  const memLimit = layer.memoryLimit
  const cpuPercent =
    cpuLimit > 0
      ? Math.min(100, Math.round((layer.cpuUsage / cpuLimit) * 100))
      : Math.min(100, Math.round(layer.cpuUsage * 100))
  const memPercent =
    memLimit > 0
      ? Math.min(100, Math.round((layer.memoryBytes / memLimit) * 100))
      : Math.min(100, Math.round((layer.memoryBytes / (512 * 1024 * 1024)) * 100))
  return { cpuPercent, memPercent }
}

export function parseComponentLayers(raw: unknown): ComponentLayerMetrics[] {
  if (!Array.isArray(raw)) return []
  const out: ComponentLayerMetrics[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    if (!id) continue
    const restartCount = Math.round(num(r.restartCount))
    const redisOps = num(r.redisOpsPerSec)
    const redisHits = num(r.redisKeyspaceHits)
    const redisMisses = num(r.redisKeyspaceMisses)
    const redisRejected = num(r.redisRejectedRate)
    out.push({
      id,
      role: typeof r.role === 'string' ? r.role.trim() : '',
      engine: typeof r.engine === 'string' ? r.engine.trim() : '',
      cpuUsage: num(r.cpuUsage),
      memoryBytes: Math.round(num(r.memoryUsage ?? r.memoryBytes)),
      cpuLimit: num(r.cpuLimit),
      memoryLimit: Math.round(num(r.memoryLimit)),
      cpuIsEstimated: Boolean(r.cpuIsEstimated),
      memIsEstimated: Boolean(r.memIsEstimated),
      cpuSource: parseResourceUsageSource(r.cpuSource),
      memSource: parseResourceUsageSource(r.memSource),
      redisOpsPerSec: redisOps > 0 ? redisOps : undefined,
      redisKeyspaceHits: redisHits > 0 ? redisHits : undefined,
      redisKeyspaceMisses: redisMisses > 0 ? redisMisses : undefined,
      redisRejectedRate: redisRejected > 0 ? redisRejected : undefined,
      restartCount: restartCount > 0 ? restartCount : undefined,
    })
  }
  return out.sort(
    (a, b) =>
      (LAYER_ROLE_ORDER[a.role] ?? 99) - (LAYER_ROLE_ORDER[b.role] ?? 99) ||
      a.id.localeCompare(b.id),
  )
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
