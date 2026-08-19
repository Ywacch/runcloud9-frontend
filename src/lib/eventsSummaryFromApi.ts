/** Flat highlight reel entries from `metrics_summary.events_summary` after teardown. */
export interface SessionEventSummary {
  timestamp: string
  type: string
  rule: string
  component?: string
  narrative?: string
  suggestion?: string
  related?: string[]
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return undefined
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
    out.push({
      timestamp,
      type,
      rule,
      component: str(r.component),
      narrative: str(r.narrative),
      suggestion: str(r.suggestion),
      related: Array.isArray(r.related)
        ? r.related.map((x) => String(x)).filter(Boolean)
        : undefined,
    })
  }
  return out
}
