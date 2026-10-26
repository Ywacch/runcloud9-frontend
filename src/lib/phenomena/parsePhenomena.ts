import type { PhenomenonEntry } from './types'

function parseCost(raw: unknown): PhenomenonEntry['cost'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const readsAffected = Number(o.readsAffected)
  if (!Number.isFinite(readsAffected)) return undefined
  const threadsAffected = Number(o.threadsAffected)
  return {
    readsAffected,
    threadsAffected: Number.isFinite(threadsAffected) ? threadsAffected : undefined,
  }
}

function parseBaseRate(raw: unknown): PhenomenonEntry['baseRate'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const perThousand = Number(o.perThousand)
  const reads = Number(o.reads)
  const denominator = typeof o.denominator === 'string' ? o.denominator : ''
  if (!Number.isFinite(perThousand) || !Number.isFinite(reads) || !denominator) {
    return undefined
  }
  return { perThousand, denominator, reads }
}

function parseExpected(raw: unknown): PhenomenonEntry['expected'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const minPerThousand = Number(o.minPerThousand)
  const maxPerThousand = Number(o.maxPerThousand)
  if (!Number.isFinite(minPerThousand) || !Number.isFinite(maxPerThousand)) return undefined
  return { minPerThousand, maxPerThousand }
}

function parseExamples(raw: unknown): PhenomenonEntry['examples'] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PhenomenonEntry['examples'] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const requestId = typeof o.requestId === 'string' ? o.requestId : ''
    const at = typeof o.at === 'string' ? o.at : ''
    if (!requestId || !at) continue
    let detail: Record<string, string> | undefined
    if (o.detail && typeof o.detail === 'object' && !Array.isArray(o.detail)) {
      detail = {}
      for (const [k, v] of Object.entries(o.detail as Record<string, unknown>)) {
        if (typeof v === 'string') detail[k] = v
      }
    }
    out.push({ requestId, at, detail })
  }
  return out.length ? out : undefined
}

/** Normalize WS `phenomena` array; drops malformed entries. */
export function parsePhenomena(raw: unknown): PhenomenonEntry[] {
  if (!Array.isArray(raw)) return []
  const out: PhenomenonEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const phenomenon = typeof o.phenomenon === 'string' ? o.phenomenon : ''
    const fidelity = typeof o.fidelity === 'string' ? o.fidelity : ''
    const cost = parseCost(o.cost)
    const baseRate = parseBaseRate(o.baseRate)
    if (!phenomenon || !fidelity || !cost || !baseRate) continue
    const sources = Array.isArray(o.sources)
      ? o.sources.map((s) => String(s)).filter(Boolean)
      : []
    let cause: Record<string, unknown> | undefined
    if (o.cause && typeof o.cause === 'object' && !Array.isArray(o.cause)) {
      cause = { ...(o.cause as Record<string, unknown>) }
    }
    out.push({
      phenomenon,
      runRole: typeof o.runRole === 'string' ? o.runRole : undefined,
      fidelity,
      cost,
      baseRate,
      expected: parseExpected(o.expected),
      examples: parseExamples(o.examples),
      cause,
      sources,
      detectionMayBeIncomplete: o.detectionMayBeIncomplete === true,
    })
  }
  return out
}

export function findReplyBeforeParentEntry(
  entries: PhenomenonEntry[] | undefined,
): PhenomenonEntry | undefined {
  return entries?.find((e) => e.phenomenon === 'reply_before_parent')
}
