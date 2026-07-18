/** Cache-node TTL: 0 = no expiry; 1–86400 = timed expiry (seconds). */
export const CACHE_TTL_MIN = 1
export const CACHE_TTL_MAX = 86400

export const CACHE_TTL_VALIDATION =
  'Enter a whole number from 1 to 86400 seconds.'

export const CACHE_TTL_HELPER =
  'How long cache entries remain before Redis removes them. This happens independently of memory-pressure eviction.'

export const VOLATILE_NO_EXPIRY_WARNING =
  'This eviction policy can only remove keys that have a TTL. With No expiry enabled, these keys are not eviction candidates when memory fills up.'

/** Template-specific defaults for new cache-node designs. */
const TEMPLATE_CACHE_TTL_DEFAULTS: Record<string, number> = {
  'url-shortener': 300,
  ecommerce: 60,
  'social-feed': 0,
}

export function defaultCacheTtlSecondsForTemplate(
  templateId: unknown,
): number | undefined {
  const id = String(templateId ?? '').trim()
  if (!id || !(id in TEMPLATE_CACHE_TTL_DEFAULTS)) return undefined
  return TEMPLATE_CACHE_TTL_DEFAULTS[id]
}

/** True for integer 0 (no expiry) or 1–86400. */
export function isValidCacheTtlSeconds(raw: unknown): boolean {
  if (typeof raw === 'number') {
    return (
      Number.isInteger(raw) &&
      (raw === 0 || (raw >= CACHE_TTL_MIN && raw <= CACHE_TTL_MAX))
    )
  }
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return false
  const n = Number(trimmed)
  return (
    Number.isInteger(n) &&
    (n === 0 || (n >= CACHE_TTL_MIN && n <= CACHE_TTL_MAX))
  )
}

/** Timed mode only — rejects 0. */
export function isValidTimedCacheTtlSeconds(raw: unknown): boolean {
  if (typeof raw === 'number') {
    return (
      Number.isInteger(raw) && raw >= CACHE_TTL_MIN && raw <= CACHE_TTL_MAX
    )
  }
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return false
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= CACHE_TTL_MIN && n <= CACHE_TTL_MAX
}

export function parseCacheTtlSeconds(raw: unknown): number | null {
  if (!isValidCacheTtlSeconds(raw)) return null
  if (typeof raw === 'number') return raw
  return Number(String(raw).trim())
}

export function parseTimedCacheTtlSeconds(raw: unknown): number | null {
  if (!isValidTimedCacheTtlSeconds(raw)) return null
  if (typeof raw === 'number') return raw
  return Number(String(raw).trim())
}

/** Commit gate for timed TTL drafts — invalid keeps last design value. */
export function commitTimedCacheTtlDraft(
  draft: unknown,
  previous: number,
): { ok: true; next: number; changed: boolean } | { ok: false } {
  const next = parseTimedCacheTtlSeconds(draft)
  if (next == null) return { ok: false }
  return { ok: true, next, changed: next !== previous }
}

/**
 * Deploy wire value: emit a number when valid; otherwise omit so the backend
 * keeps the image/template default for legacy designs.
 */
export function deployCacheTtlSeconds(raw: unknown): number | undefined {
  return parseCacheTtlSeconds(raw) ?? undefined
}

/**
 * Seed template default when the cache-node key is absent.
 * Does not overwrite an existing value (including 0).
 */
export function seedCacheTtlSecondsDefault(
  config: Record<string, unknown>,
  templateId: unknown,
): Record<string, unknown> {
  if (config.cacheTtlSeconds != null) return config
  const def = defaultCacheTtlSecondsForTemplate(templateId)
  if (def == null) return config
  return { ...config, cacheTtlSeconds: def }
}

export function showVolatileNoExpiryWarning(
  evictionPolicy: unknown,
  cacheTtlSeconds: unknown,
): boolean {
  const ttl = parseCacheTtlSeconds(cacheTtlSeconds)
  if (ttl !== 0) return false
  return String(evictionPolicy ?? '')
    .trim()
    .toLowerCase()
    .startsWith('volatile-')
}
