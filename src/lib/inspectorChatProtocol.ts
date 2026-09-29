import type { ClaimGrounding } from './eventsSummaryFromApi'

export type InspectorChatClaim = {
  scope: string
  aspect: string
  text: string
  grounding: ClaimGrounding
  components?: string[]
  factRefs?: string[]
  mechanismId?: string
}

export type InspectorChatMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string
      role: 'assistant'
      text: string
      streaming?: boolean
      claims?: InspectorChatClaim[]
    }

export type ChatBudgetState = {
  limit: number
  spent: number
  remaining: number
  exhausted: boolean
}

export type ChatServerFrame =
  | { type: 'session'; budgetLimit?: number; budgetSpent?: number; budgetRemaining?: number; budgetExhausted?: boolean }
  | { type: 'pong' }
  | { type: 'assistant_start' }
  | { type: 'assistant_delta'; text?: string }
  | { type: 'assistant_claim'; claim?: InspectorChatClaim }
  | {
      type: 'assistant_end'
      reply?: string
      claims?: InspectorChatClaim[]
      budgetSpent?: number
      budgetRemaining?: number
    }
  | { type: 'error'; code?: string; message?: string }

export function parseChatServerFrame(raw: unknown): ChatServerFrame | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const type = row.type
  if (type === 'session') {
    return {
      type: 'session',
      budgetLimit: numberOrZero(row.budgetLimit),
      budgetSpent: numberOrZero(row.budgetSpent),
      budgetRemaining: numberOrZero(row.budgetRemaining),
      budgetExhausted: row.budgetExhausted === true,
    }
  }
  if (type === 'pong') return { type: 'pong' }
  if (type === 'assistant_start') return { type: 'assistant_start' }
  if (type === 'assistant_delta') {
    return { type: 'assistant_delta', text: typeof row.text === 'string' ? row.text : '' }
  }
  if (type === 'assistant_claim') {
    const claim = parseClaim(row.claim)
    return claim ? { type: 'assistant_claim', claim } : null
  }
  if (type === 'assistant_end') {
    const claims = Array.isArray(row.claims)
      ? row.claims.map(parseClaim).filter((c): c is InspectorChatClaim => c != null)
      : undefined
    return {
      type: 'assistant_end',
      reply: typeof row.reply === 'string' ? row.reply : '',
      claims,
      budgetSpent: numberOrZero(row.budgetSpent),
      budgetRemaining: numberOrZero(row.budgetRemaining),
    }
  }
  if (type === 'error') {
    return {
      type: 'error',
      code: typeof row.code === 'string' ? row.code : undefined,
      message: typeof row.message === 'string' ? row.message : undefined,
    }
  }
  return null
}

function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function parseClaim(raw: unknown): InspectorChatClaim | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const grounding = row.grounding
  if (grounding !== 'authored' && grounding !== 'inferred' && grounding !== 'abstained') {
    return null
  }
  const text = typeof row.text === 'string' ? row.text : ''
  const scope = typeof row.scope === 'string' ? row.scope : ''
  const aspect = typeof row.aspect === 'string' ? row.aspect : ''
  if (!text || !scope || !aspect) return null
  return {
    scope,
    aspect,
    text,
    grounding,
    components: stringArray(row.components),
    factRefs: stringArray(row.factRefs),
    mechanismId: typeof row.mechanismId === 'string' ? row.mechanismId : undefined,
  }
}

function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((x): x is string => typeof x === 'string')
  return out.length ? out : undefined
}
