export type ClaimGrounding = 'authored' | 'inferred' | 'abstained'

/** Verified caption from cloud9-api after inference + claim verifier (optional). */
export interface ReelCaption {
  text: string
  grounding: ClaimGrounding
  factRefs?: string[]
  mechanismId?: string
}

/** Flat highlight reel entries from `metrics_summary.events_summary` after teardown. */
export interface SessionEventSummary {
  timestamp: string
  type: string
  rule: string
  component?: string
  narrative?: string
  suggestion?: string
  related?: string[]
  caption?: ReelCaption
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return undefined
}

function parseGrounding(v: unknown): ClaimGrounding | undefined {
  if (v === 'authored' || v === 'inferred' || v === 'abstained') return v
  return undefined
}

function parseReelCaption(raw: unknown): ReelCaption | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Record<string, unknown>
  const text = str(c.text)
  const grounding = parseGrounding(c.grounding)
  if (!text || !grounding) return undefined
  const caption: ReelCaption = { text, grounding }
  if (Array.isArray(c.factRefs)) {
    const refs = c.factRefs.map((x) => String(x)).filter(Boolean)
    if (refs.length) caption.factRefs = refs
  }
  const mechanismId = str(c.mechanismId)
  if (mechanismId) caption.mechanismId = mechanismId
  return caption
}

export function parseEventsSummary(raw: unknown): SessionEventSummary[] {
  if (!Array.isArray(raw)) return []
  const out: SessionEventSummary[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const rule = str(r.rule) ?? str(r.ruleId) ?? str(r.title)
    if (!rule) continue
    const type = str(r.type) ?? 'threshold'
    const timestamp = str(r.timestamp) ?? new Date().toISOString()
    const entry: SessionEventSummary = {
      timestamp,
      type,
      rule,
      component: str(r.component),
      narrative: str(r.narrative),
      suggestion: str(r.suggestion),
      related: Array.isArray(r.related)
        ? r.related.map((x) => String(x)).filter(Boolean)
        : undefined,
    }
    const caption = parseReelCaption(r.caption)
    if (caption) entry.caption = caption
    out.push(entry)
  }
  return out
}
