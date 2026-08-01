/** App-server / worker replica limits (metrics-ui-contract). */
export const APP_SERVER_REPLICA_MIN = 1
export const APP_SERVER_REPLICA_MAX = 3
/** Workers share the app-server horizontal scale ceiling. */
export const WORKER_REPLICA_MIN = APP_SERVER_REPLICA_MIN
export const WORKER_REPLICA_MAX = APP_SERVER_REPLICA_MAX

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

/** Map canvas LB config to API canonical `lbAlgorithm`. */
export function lbAlgorithmForDeploy(algorithm: unknown): string {
  const a = String(algorithm ?? 'round-robin').trim()
  const map: Record<string, string> = {
    'round-robin': 'round-robin',
    round_robin: 'round-robin',
    'least-connections': 'least_conn',
    least_conn: 'least_conn',
    'ip-hash': 'ip_hash',
    ip_hash: 'ip_hash',
  }
  return map[a] ?? a
}
