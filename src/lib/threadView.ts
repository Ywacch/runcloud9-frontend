export interface ThreadPost {
  id: number
  reply_to_id?: number | null
  user_id?: number
  content: string
  created_at: string
}

export interface ThreadViewNode {
  id: number
  missing: boolean
  flattened: boolean
  depth: number
  userId: number | null
  content: string
  ageLabel: string
  children: ThreadViewNode[]
}

export interface ThreadView {
  rootId: number
  servedByReplies: string
  servedByParents: string
  root: ThreadViewNode
  replyCount: number
}

export interface ThreadPoolEntry {
  rootId: number
  replyCount: number
}

const MAX_THREAD_DEPTH = 6
const MISSING_ROOT = 'root not visible on this replica yet'
const MISSING_PARENT = 'parent not visible on this replica yet'

type StoredPost = ThreadPost & { missing: boolean }

type InternalNode = {
  post: StoredPost
  missing: boolean
  children: InternalNode[]
}

export function buildThreadView(
  response: {
    rootId: number
    replies?: ThreadPost[]
    parents?: ThreadPost[]
    servedBy?: { replies?: string; parents?: string }
  },
  nowMs: number,
): ThreadView {
  const rootId = response.rootId
  const parents = response.parents ?? []
  const replies = response.replies ?? []

  const posts = new Map<number, StoredPost>()
  const addPost = (p: ThreadPost, missing: boolean) => {
    if (posts.has(p.id)) return
    posts.set(p.id, { ...p, missing })
  }
  for (const p of parents) addPost(p, false)
  for (const p of replies) addPost(p, false)

  const seenReplyIds = new Set<number>()
  let replyCount = 0
  for (const p of replies) {
    if (seenReplyIds.has(p.id)) continue
    seenReplyIds.add(p.id)
    replyCount++
  }

  if (!posts.has(rootId)) {
    posts.set(rootId, {
      id: rootId,
      content: MISSING_ROOT,
      created_at: '',
      missing: true,
    })
  }

  const childIDs = new Map<number, number[]>()
  const linkChild = (parentId: number, childId: number) => {
    if (parentId === childId) return
    const list = childIDs.get(parentId) ?? []
    if (!list.includes(childId)) list.push(childId)
    childIDs.set(parentId, list)
  }

  const processedReplies = new Set<number>()
  for (const p of replies) {
    if (processedReplies.has(p.id)) continue
    processedReplies.add(p.id)

    const parentId = p.reply_to_id ?? rootId
    if (!posts.has(parentId)) {
      posts.set(parentId, {
        id: parentId,
        content: MISSING_PARENT,
        created_at: '',
        missing: true,
      })
      linkChild(rootId, parentId)
    }
    linkChild(parentId, p.id)
  }

  const buildNode = (id: number, visiting: Set<number>): InternalNode => {
    const stored = posts.get(id)
    if (!stored) {
      return {
        post: {
          id,
          content: MISSING_PARENT,
          created_at: '',
          missing: true,
        },
        missing: true,
        children: [],
      }
    }
    const node: InternalNode = {
      post: stored,
      missing: stored.missing,
      children: [],
    }
    const kids = childIDs.get(id) ?? []
    for (const kidId of kids) {
      if (kidId === id || visiting.has(kidId)) continue
      visiting.add(kidId)
      node.children.push(buildNode(kidId, visiting))
      visiting.delete(kidId)
    }
    sortInternalChildren(node.children)
    return node
  }

  const root = toViewNode(buildNode(rootId, new Set()), 0, nowMs)

  return {
    rootId,
    servedByReplies: response.servedBy?.replies ?? '',
    servedByParents: response.servedBy?.parents ?? '',
    root,
    replyCount,
  }
}

function sortInternalChildren(nodes: InternalNode[]) {
  nodes.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? 1 : -1
    const ta = a.missing ? '' : a.post.created_at
    const tb = b.missing ? '' : b.post.created_at
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.post.id - b.post.id
  })
}

function toViewNode(node: InternalNode, depth: number, nowMs: number): ThreadViewNode {
  const missing = node.missing
  const view: ThreadViewNode = {
    id: node.post.id,
    missing,
    flattened: false,
    depth,
    userId: missing ? null : node.post.user_id ?? null,
    content: node.post.content,
    ageLabel: missing ? '' : formatThreadAge(node.post.created_at, nowMs),
    children: [],
  }
  for (const child of node.children) {
    if (depth >= MAX_THREAD_DEPTH) {
      const flat = toViewNode(child, depth, nowMs)
      flat.flattened = true
      view.children.push(flat)
    } else {
      view.children.push(toViewNode(child, depth + 1, nowMs))
    }
  }
  return view
}

export function formatThreadAge(createdAtIso: string, nowMs: number): string {
  if (!createdAtIso) return ''
  const created = Date.parse(createdAtIso)
  if (!Number.isFinite(created)) return ''
  const deltaMs = Math.max(0, nowMs - created)
  const sec = Math.floor(deltaMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${Math.max(1, min)}m ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h ago`
  const d = new Date(created)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function threadPoolOptionLabel(rootId: number, replyCount: number): string {
  const noun = replyCount === 1 ? 'reply' : 'replies'
  return `#${rootId} · ${replyCount} ${noun}`
}

export function threadProxyArgs(
  path: string,
  actAsUserId: string,
): { path: string; actAsUserId?: string } {
  const trimmed = actAsUserId.trim()
  if (!trimmed) return { path }
  return { path, actAsUserId: trimmed }
}

export function parseThreadPoolEntries(body: unknown): ThreadPoolEntry[] {
  if (!body || typeof body !== 'object') return []
  const raw = (body as Record<string, unknown>).threads
  if (!Array.isArray(raw)) return []
  const out: ThreadPoolEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const rootId = o.rootId
    const replyCount = o.replyCount
    if (
      typeof rootId === 'number' &&
      Number.isFinite(rootId) &&
      typeof replyCount === 'number' &&
      Number.isFinite(replyCount)
    ) {
      out.push({ rootId: Math.trunc(rootId), replyCount: Math.trunc(replyCount) })
    }
  }
  return out
}

export function tryParseThreadResponse(bodyText: string): {
  rootId: number
  replies?: ThreadPost[]
  parents?: ThreadPost[]
  servedBy?: { replies?: string; parents?: string }
} | null {
  try {
    const v = JSON.parse(bodyText) as Record<string, unknown>
    if (typeof v.rootId !== 'number' || !Number.isFinite(v.rootId)) return null
    const replies = parseThreadPosts(v.replies)
    const parents = parseThreadPosts(v.parents)
    const servedBy = parseServedBy(v.servedBy)
    return {
      rootId: Math.trunc(v.rootId),
      replies,
      parents,
      servedBy,
    }
  } catch {
    return null
  }
}

function parseThreadPosts(raw: unknown): ThreadPost[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ThreadPost[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (typeof o.id !== 'number' || !Number.isFinite(o.id)) continue
    if (typeof o.content !== 'string') continue
    if (typeof o.created_at !== 'string') continue
    const post: ThreadPost = {
      id: Math.trunc(o.id),
      content: o.content,
      created_at: o.created_at,
    }
    if (typeof o.user_id === 'number' && Number.isFinite(o.user_id)) {
      post.user_id = Math.trunc(o.user_id)
    }
    if (o.reply_to_id === null) {
      post.reply_to_id = null
    } else if (typeof o.reply_to_id === 'number' && Number.isFinite(o.reply_to_id)) {
      post.reply_to_id = Math.trunc(o.reply_to_id)
    }
    out.push(post)
  }
  return out
}

function parseServedBy(
  raw: unknown,
): { replies?: string; parents?: string } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const replies = typeof o.replies === 'string' ? o.replies : undefined
  const parents = typeof o.parents === 'string' ? o.parents : undefined
  if (!replies && !parents) return undefined
  return { replies, parents }
}
