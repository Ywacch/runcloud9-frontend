export function replicaStaggerMs(readReplicas: number, raw: unknown): number {
  if (readReplicas < 2) return 0
  const delays = parseReplicaApplyDelayMs(raw, readReplicas)
  if (delays.length !== readReplicas) return 0
  let minD = delays[0]
  let maxD = delays[0]
  for (const d of delays) {
    if (d < minD) minD = d
    if (d > maxD) maxD = d
  }
  return maxD - minD
}

function parseReplicaApplyDelayMs(raw: unknown, readReplicas: number): number[] {
  if (raw == null) return []
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const v = Math.max(0, Math.floor(raw))
    return Array.from({ length: readReplicas }, () => v)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 1) {
      const v = Number(parts[0])
      if (!Number.isFinite(v)) return []
      const ms = Math.max(0, Math.floor(v))
      return Array.from({ length: readReplicas }, () => ms)
    }
    if (parts.length !== readReplicas) return []
    const out: number[] = []
    for (const p of parts) {
      const v = Number(p)
      if (!Number.isFinite(v)) return []
      out.push(Math.max(0, Math.floor(v)))
    }
    return out
  }
  if (Array.isArray(raw)) {
    if (raw.length !== readReplicas) return []
    const out: number[] = []
    for (const item of raw) {
      const v = typeof item === 'number' ? item : Number(item)
      if (!Number.isFinite(v)) return []
      out.push(Math.max(0, Math.floor(v)))
    }
    return out
  }
  return []
}

export function conversationsDefaultOn(input: {
  conversationsOffered: boolean
  readReplicas: number
  replicaApplyDelayMs: unknown
}): boolean {
  if (!input.conversationsOffered) return false
  if (input.readReplicas < 2) return false
  return replicaStaggerMs(input.readReplicas, input.replicaApplyDelayMs) > 0
}

export type ConversationLaneVU = {
  behaviors?: Record<string, { vus?: number; requests?: number }>
  observer?: { threadReads?: number }
}

export function conversationLaneMetrics(vu: ConversationLaneVU | null | undefined) {
  let vus = 0
  let posts = 0
  let replies = 0
  const behaviors = vu?.behaviors ?? {}
  for (const [name, stat] of Object.entries(behaviors)) {
    vus += Number(stat?.vus ?? 0)
    if (name === 'conversation_starter') {
      posts += Number(stat?.requests ?? 0)
    }
    if (name === 'replier') {
      replies += Number(stat?.requests ?? 0)
    }
  }
  const threadReads = Number(vu?.observer?.threadReads ?? 0)
  return { vus, posts, replies, threadReads }
}

export function conversationLaneSummary(
  vu: ConversationLaneVU | null | undefined,
): string | null {
  if (!vu) return null
  const { vus, posts, replies, threadReads } = conversationLaneMetrics(vu)
  return `${vus} in conversations · ${posts} posts · ${replies} replies · ${threadReads} thread reads`
}

export function conversationLaneFingerprint(
  vu: ConversationLaneVU | null | undefined,
): string {
  const { vus, posts, replies, threadReads } = conversationLaneMetrics(vu)
  return `${vus}:${posts}:${replies}:${threadReads}`
}
