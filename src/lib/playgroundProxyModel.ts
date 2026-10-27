/** Browser header for act-as user id (digits only); validated by the API. */
export const HEADER_ACT_AS = 'X-C9-Act-As'

export function parseUserPoolUserIds(body: unknown, max = 50): string[] {
  if (!body || typeof body !== 'object') return []
  const raw = (body as Record<string, unknown>).userIds
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      out.push(String(Math.trunc(item)))
    } else if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
      out.push(item.trim())
    }
    if (out.length >= max) break
  }
  return out
}

export interface ThreadServedBy {
  replies?: string
  parents?: string
}

export function parseThreadServedBy(bodyText: string): ThreadServedBy | null {
  try {
    const v = JSON.parse(bodyText) as Record<string, unknown>
    const sb = v.servedBy
    if (!sb || typeof sb !== 'object' || Array.isArray(sb)) return null
    const o = sb as Record<string, unknown>
    const replies = typeof o.replies === 'string' ? o.replies : undefined
    const parents = typeof o.parents === 'string' ? o.parents : undefined
    if (!replies && !parents) return null
    return { replies, parents }
  } catch {
    return null
  }
}

export function isSocialFeedTemplate(templateId: string | null | undefined): boolean {
  return typeof templateId === 'string' && templateId.startsWith('social-feed')
}
