/** Matches fanout-worker image when WORKER_* env vars are omitted (topology.go). */
export const WORKER_IMAGE_DEFAULT_PREFETCH = 10
export const WORKER_IMAGE_DEFAULT_CONCURRENCY = 1

export type EffectiveWorkerInt = { n: number; fromDefault: boolean }

function positiveIntConfig(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 1) return undefined
  return Math.floor(n)
}

export function effectiveWorkerPrefetch(
  config: Record<string, unknown>,
): EffectiveWorkerInt {
  const configured = positiveIntConfig(config.workerPrefetch)
  if (configured != null) return { n: configured, fromDefault: false }
  return { n: WORKER_IMAGE_DEFAULT_PREFETCH, fromDefault: true }
}

export function effectiveWorkerConcurrency(
  config: Record<string, unknown>,
): EffectiveWorkerInt {
  const configured = positiveIntConfig(config.workerConcurrency)
  if (configured != null) return { n: configured, fromDefault: false }
  return { n: WORKER_IMAGE_DEFAULT_CONCURRENCY, fromDefault: true }
}

export function formatEffectiveWorkerInt(v: EffectiveWorkerInt): string {
  return v.fromDefault ? `${v.n} (default)` : String(v.n)
}
