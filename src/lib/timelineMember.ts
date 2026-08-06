/** Redis SCAN / KEYS style glob: `*` and `?` only. */
export function matchRedisPattern(key: string, pattern: string): boolean {
  if (pattern === '*') return true
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`).test(key)
}

export type ZsetRow = { member: string; score: string }

export function parseZsetRows(value: unknown): ZsetRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    if (Array.isArray(row) && row.length >= 2) {
      return {
        member: memberToString(row[0]),
        score: String(row[1] ?? ''),
      }
    }
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const o = row as Record<string, unknown>
      return {
        member: memberToString(o.member ?? o.m ?? o[0]),
        score: String(o.score ?? o.s ?? o[1] ?? ''),
      }
    }
    return { member: memberToString(row), score: '' }
  })
}

function memberToString(v: unknown): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export type TimelinePost = {
  authorId: string
  content: string
  createdAt: number | null
}

/** Parse a zset member string as a timeline post JSON blob. */
export function parseTimelineMember(member: string): TimelinePost | null {
  const trimmed = member.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>
    const content = data.content
    const authorRaw = data.author_id ?? data.authorId
    if (typeof content !== 'string' || content.length === 0) return null
    if (authorRaw == null || (typeof authorRaw !== 'string' && typeof authorRaw !== 'number')) {
      return null
    }
    return {
      authorId: String(authorRaw),
      content,
      createdAt: parseCreatedAt(data.created_at ?? data.createdAt),
    }
  } catch {
    return null
  }
}

function parseCreatedAt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Heuristic: seconds vs milliseconds
    return raw < 1e12 ? raw * 1000 : raw
  }
  if (typeof raw === 'string' && raw.trim()) {
    const asNum = Number(raw)
    if (Number.isFinite(asNum) && raw.trim() === String(asNum)) {
      return asNum < 1e12 ? asNum * 1000 : asNum
    }
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/**
 * Detection for Raw / Timeline toggle:
 * 1) key matches a template keyPattern (or timeline: fallback)
 * 2) type is zset
 * 3) first member parses as timeline JSON
 */
export function canShowTimelineView(opts: {
  key: string
  type: string
  value: unknown
  keyPatterns?: string[]
}): boolean {
  if (opts.type.toLowerCase() !== 'zset') return false
  if (!keyMatchesTimelinePattern(opts.key, opts.keyPatterns)) return false
  const rows = parseZsetRows(opts.value)
  if (rows.length === 0) return false
  return parseTimelineMember(rows[0].member) != null
}

export function keyMatchesTimelinePattern(
  key: string,
  keyPatterns?: string[],
): boolean {
  const specific = (keyPatterns ?? []).filter((p) => p && p !== '*')
  if (specific.length > 0) {
    return specific.some((p) => matchRedisPattern(key, p))
  }
  return key.toLowerCase().startsWith('timeline:')
}

/** Compact relative age for feed headers (no em dashes). */
export function formatRelativeTime(
  createdAtMs: number | null,
  nowMs: number = Date.now(),
): string {
  if (createdAtMs == null || !Number.isFinite(createdAtMs)) return 'just now'
  const delta = Math.max(0, nowMs - createdAtMs)
  const sec = Math.floor(delta / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day}d ago`
  return new Date(createdAtMs).toLocaleDateString()
}
