/** App-server / worker replica limits (metrics-ui-contract). */
export const APP_SERVER_REPLICA_MIN = 1
export const APP_SERVER_REPLICA_MAX = 3
/** Workers share the app-server horizontal scale ceiling. */
export const WORKER_REPLICA_MIN = APP_SERVER_REPLICA_MIN
export const WORKER_REPLICA_MAX = APP_SERVER_REPLICA_MAX

export const DB_READ_REPLICA_MIN = 0
export const DB_READ_REPLICA_MAX = 2

export function clampReadReplicas(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DB_READ_REPLICA_MIN
  return Math.min(
    DB_READ_REPLICA_MAX,
    Math.max(DB_READ_REPLICA_MIN, Math.floor(n)),
  )
}

export function normalizeReplicationModeForDeploy(
  raw: unknown,
  readReplicas: number,
): 'async' | 'sync' {
  if (readReplicas <= 0) return 'async'
  const mode = String(raw ?? 'async').trim().toLowerCase()
  if (mode === 'sync' || mode === 'synchronous') return 'sync'
  return 'async'
}

export function clampAppServerReplicas(
  raw: unknown,
  max: number = APP_SERVER_REPLICA_MAX,
): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return APP_SERVER_REPLICA_MIN
  const ceiling = Math.max(APP_SERVER_REPLICA_MIN, Math.floor(max))
  return Math.min(ceiling, Math.max(APP_SERVER_REPLICA_MIN, Math.floor(n)))
}

/** Alias for worker replica clamping (same [1, max] policy). */
export function clampWorkerReplicas(
  raw: unknown,
  max: number = WORKER_REPLICA_MAX,
): number {
  return clampAppServerReplicas(raw, max)
}

/** Live deploy LB algorithms (nginx methods teachable with virtual client IPs). */
export const LIVE_LB_ALGORITHMS = [
  'round-robin',
  'least_conn',
  'random',
  'ip_hash',
  'least_time',
] as const

export type LiveLBAlgorithm = (typeof LIVE_LB_ALGORITHMS)[number]

const LIVE_LB_SET = new Set<string>(LIVE_LB_ALGORITHMS)

/** Map canvas LB config to API canonical live `lbAlgorithm`. */
export function lbAlgorithmForDeploy(algorithm: unknown): LiveLBAlgorithm {
  const a = String(algorithm ?? 'round-robin').trim()
  const map: Record<string, LiveLBAlgorithm> = {
    'round-robin': 'round-robin',
    round_robin: 'round-robin',
    'least-connections': 'least_conn',
    least_conn: 'least_conn',
    random: 'random',
    'ip-hash': 'ip_hash',
    ip_hash: 'ip_hash',
    iphash: 'ip_hash',
    least_time: 'least_time',
    'least-time': 'least_time',
    'least-response-time': 'least_time',
  }
  const mapped = map[a]
  if (mapped) return mapped
  if (LIVE_LB_SET.has(a)) return a as LiveLBAlgorithm
  return 'round-robin'
}

