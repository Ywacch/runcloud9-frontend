/** Matches ganymede write-behind flush interval clamp (1–300, default 30). */
export const WRITE_BEHIND_INTERVAL_DEFAULT = 30
export const WRITE_BEHIND_INTERVAL_MIN = 1
export const WRITE_BEHIND_INTERVAL_MAX = 300

export const WRITE_BEHIND_INTERVAL_VALIDATION =
  'Enter a whole number from 1 to 300 seconds.'

/**
 * URL-shortener-only today: the proxy flusher persists URL records and is not
 * schema-generic. Keep the template allowlist in one place for later expansion.
 */
const WRITE_BEHIND_INTERVAL_TEMPLATES = new Set(['url-shortener'])

export function templateSupportsWriteBehindInterval(
  templateId: unknown,
): boolean {
  return WRITE_BEHIND_INTERVAL_TEMPLATES.has(String(templateId ?? '').trim())
}

export function showsWriteBehindIntervalControl(
  templateId: unknown,
  strategy: unknown,
): boolean {
  return (
    templateSupportsWriteBehindInterval(templateId) &&
    String(strategy ?? '') === 'write-behind'
  )
}

/** True when raw is a finite integer in [1, 300]. */
export function isValidWriteBehindInterval(raw: unknown): boolean {
  if (typeof raw === 'number') {
    return (
      Number.isInteger(raw) &&
      raw >= WRITE_BEHIND_INTERVAL_MIN &&
      raw <= WRITE_BEHIND_INTERVAL_MAX
    )
  }
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return false
  const n = Number(trimmed)
  return (
    Number.isInteger(n) &&
    n >= WRITE_BEHIND_INTERVAL_MIN &&
    n <= WRITE_BEHIND_INTERVAL_MAX
  )
}

/**
 * Parse user/draft input. Returns null when invalid so the design keeps the
 * last valid value and the UI can show validation copy.
 */
export function parseWriteBehindIntervalInput(raw: unknown): number | null {
  if (!isValidWriteBehindInterval(raw)) return null
  if (typeof raw === 'number') return raw
  return Number(String(raw).trim())
}

/** Commit gate for inspector drafts — invalid keeps last design value. */
export function commitWriteBehindIntervalDraft(
  draft: unknown,
  previous: number,
): { ok: true; next: number; changed: boolean } | { ok: false } {
  const next = parseWriteBehindIntervalInput(draft)
  if (next == null) return { ok: false }
  return { ok: true, next, changed: next !== previous }
}

/**
 * Deploy / hydrate normalization: missing, zero, negative, malformed → 30;
 * above 300 → 300. Always returns an integer in range.
 */
export function normalizeWriteBehindIntervalSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    if (n < WRITE_BEHIND_INTERVAL_MIN) return WRITE_BEHIND_INTERVAL_DEFAULT
    if (n > WRITE_BEHIND_INTERVAL_MAX) return WRITE_BEHIND_INTERVAL_MAX
    return n
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return WRITE_BEHIND_INTERVAL_DEFAULT
    }
    return normalizeWriteBehindIntervalSeconds(Number(trimmed))
  }
  return WRITE_BEHIND_INTERVAL_DEFAULT
}

/**
 * Seed default 30 on URL-shortener cache configs when the key is absent.
 * Does not overwrite an existing value (valid or not).
 */
export function seedWriteBehindIntervalDefault(
  config: Record<string, unknown>,
  templateId: unknown,
): Record<string, unknown> {
  if (!templateSupportsWriteBehindInterval(templateId)) return config
  if (config.writeBehindIntervalSeconds != null) return config
  return {
    ...config,
    writeBehindIntervalSeconds: WRITE_BEHIND_INTERVAL_DEFAULT,
  }
}
