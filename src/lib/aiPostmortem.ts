import type { ClaimGrounding } from './eventsSummaryFromApi'

/** One verifier-approved claim from metrics_summary.ai_postmortem. */
export interface PostmortemClaim {
  scope: string
  components: string[]
  aspect: string
  text: string
  factRefs: string[]
  grounding: ClaimGrounding
  mechanismId?: string
  confidence?: string
  requestId?: string
}

/** Persisted post-mortem written by cloud9-api after teardown. */
export type PostmortemStatus = 'pending' | 'ok' | 'skipped' | 'error'

/** Persisted post-mortem written by cloud9-api after teardown. */
export interface AIPostmortem {
  status: PostmortemStatus | string
  summary: string
  claims: PostmortemClaim[]
  insufficientEvidence: string[]
  model?: string
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return undefined
}

function grounding(v: unknown): ClaimGrounding | undefined {
  if (v === 'authored' || v === 'inferred' || v === 'abstained') return v
  return undefined
}

function parseClaim(raw: unknown): PostmortemClaim | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const row = raw as Record<string, unknown>
  const text = str(row.text)
  const g = grounding(row.grounding)
  const aspect = str(row.aspect)
  const scope = str(row.scope)
  if (!text || !g || !aspect || !scope) return undefined
  return {
    scope,
    components: Array.isArray(row.components)
      ? row.components.map((x) => String(x)).filter(Boolean)
      : [],
    aspect,
    text,
    factRefs: Array.isArray(row.factRefs)
      ? row.factRefs.map((x) => String(x)).filter(Boolean)
      : [],
    grounding: g,
    mechanismId: str(row.mechanismId),
    confidence: str(row.confidence),
    requestId: str(row.requestId),
  }
}

/** Parse metrics_summary.ai_postmortem. Missing or empty payloads return null. */
export function parseAIPostmortem(raw: unknown): AIPostmortem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const status = str(row.status)
  if (!status) return null
  if (status === 'pending' || status === 'error') {
    const claims = Array.isArray(row.claims)
      ? row.claims.map(parseClaim).filter((c): c is PostmortemClaim => c != null)
      : []
    const insufficientEvidence = Array.isArray(row.insufficientEvidence)
      ? row.insufficientEvidence.map((x) => String(x)).filter(Boolean)
      : []
    return {
      status: status as PostmortemStatus,
      summary: str(row.summary) ?? '',
      claims,
      insufficientEvidence,
      model: str(row.model),
    }
  }
  const claims = Array.isArray(row.claims)
    ? row.claims.map(parseClaim).filter((c): c is PostmortemClaim => c != null)
    : []
  const insufficientEvidence = Array.isArray(row.insufficientEvidence)
    ? row.insufficientEvidence.map((x) => String(x)).filter(Boolean)
    : []
  const summary = str(row.summary) ?? ''
  if (!summary && claims.length === 0 && insufficientEvidence.length === 0) return null
  return {
    status: status as PostmortemStatus,
    summary,
    claims,
    insufficientEvidence,
    model: str(row.model),
  }
}
