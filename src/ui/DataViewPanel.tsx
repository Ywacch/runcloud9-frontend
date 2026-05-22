import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { proxyRequest, type ProxyResponse } from '../lib/proxyApi'
import { useCanvasStore } from '../store/canvasStore'
import { useLogStore, type LogLine } from '../store/logStore'
import { templateTitleForId } from './TemplateModal'

const PROXY_COMPONENT = 'app-server'

const actionBtnClass =
  'rounded border border-[var(--c9-accent)]/50 bg-[var(--c9-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--c9-accent)] transition-colors hover:bg-[var(--c9-accent)]/20 disabled:cursor-not-allowed disabled:opacity-50'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 font-mono text-xs text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'

const sectionTitleClass =
  'text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]'

interface DataViewPanelProps {
  open: boolean
  onClose: () => void
}

interface TraceEntry {
  requestId: string
  label: string
  startedAt: number
  durationMs: number
  status: number
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--c9-accent)] border-t-transparent"
      aria-hidden
    />
  )
}

function ActionError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="mt-1 text-[11px] text-red-400">{message}</p>
}

const TRACE_HISTORY_MAX = 10

function traceOpBarClass(message: string, fields?: Record<string, unknown>): string {
  const op = String(fields?.operation ?? fields?.op ?? message).toLowerCase()
  if (op.includes('cache') || op.includes('redis')) return 'bg-cyan-500'
  if (op.includes('db') || op.includes('sql') || op.includes('postgres')) return 'bg-amber-500'
  if (op.includes('mq') || op.includes('rabbit') || op.includes('queue')) return 'bg-violet-500'
  if (
    op.includes('get_url') ||
    op.includes('shorten') ||
    op.includes('handler') ||
    op.includes('app') ||
    op.includes('http')
  ) {
    return 'bg-emerald-500'
  }
  return 'bg-[var(--c9-accent)]'
}

function traceOpLabel(line: LogLine): string {
  const msg = line.message.trim()
  const op = line.fields?.operation ?? line.fields?.op
  if (typeof op === 'string' && op) return op
  const m = msg.match(/\b(cache_\w+|db_\w+|mq_\w+|get_\w+|post_\w+)\b/i)
  if (m) return m[1]
  return msg.length > 28 ? `${msg.slice(0, 28)}…` : msg
}

function traceOpDetail(line: LogLine): string {
  const f = line.fields ?? {}
  const parts: string[] = []
  if (f.key != null) parts.push(`key=${String(f.key)}`)
  if (f.hit != null) parts.push(String(f.hit) === 'true' || f.hit === true ? 'HIT' : 'MISS')
  if (f.result != null && f.hit == null) parts.push(String(f.result))
  if (f.table != null) parts.push(String(f.table))
  if (f.query != null) {
    const q = String(f.query)
    parts.push(q.length > 24 ? `${q.slice(0, 24)}…` : q)
  }
  return parts.join(' ')
}

function extractShortCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  if (typeof o.code === 'string') return o.code
  if (typeof o.short_code === 'string') return o.short_code
  if (typeof o.shortCode === 'string') return o.shortCode
  return null
}

const SF_POST_MAX_CHARS = 280
const SF_USER_POOL_HYDRATE_LIMIT = 30

interface SocialFeedUser {
  id: number
  username: string
}

type PlaygroundDispatch = (
  actionKey: string,
  label: string,
  run: (requestId: string) => Promise<ProxyResponse>,
  onSuccess?: (result: ProxyResponse) => void,
) => void

function mapSocialFeedUserRows(arr: unknown[]): SocialFeedUser[] {
  const out: SocialFeedUser[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const u = row as Record<string, unknown>
    const id =
      typeof u.id === 'number'
        ? u.id
        : typeof u.user_id === 'number'
          ? u.user_id
          : null
    if (id == null) continue
    const username =
      typeof u.username === 'string' && u.username.trim()
        ? u.username
        : `user-${id}`
    out.push({ id, username })
  }
  return out
}

function parseSocialFeedUsers(body: unknown): SocialFeedUser[] {
  if (Array.isArray(body)) return mapSocialFeedUserRows(body)
  if (!body || typeof body !== 'object') return []
  const o = body as Record<string, unknown>
  if (Array.isArray(o.users)) return mapSocialFeedUserRows(o.users)
  if (Array.isArray(o.userIds)) {
    return (o.userIds as unknown[])
      .filter((id): id is number => typeof id === 'number')
      .map((id) => ({ id, username: `#${id}` }))
  }
  return []
}

function parseUserPoolIds(body: unknown): number[] {
  if (!body || typeof body !== 'object') return []
  const o = body as Record<string, unknown>
  if (!Array.isArray(o.userIds)) return []
  return (o.userIds as unknown[]).filter((id): id is number => typeof id === 'number')
}

async function fetchSocialFeedUserById(
  deploymentId: string,
  id: number,
): Promise<SocialFeedUser | null> {
  const res = await proxyRequest(deploymentId, PROXY_COMPONENT, `users/${id}`, {
    method: 'GET',
  })
  if (res.status >= 400) return { id, username: `user-${id}` }
  const parsed = parseSocialFeedUsers(res.body)
  if (parsed[0]) return parsed[0]
  if (res.body && typeof res.body === 'object') {
    const u = res.body as Record<string, unknown>
    if (typeof u.id === 'number') {
      return {
        id: u.id,
        username:
          typeof u.username === 'string' && u.username.trim()
            ? u.username
            : `user-${u.id}`,
      }
    }
  }
  return { id, username: `user-${id}` }
}

async function loadSocialFeedUsers(deploymentId: string): Promise<SocialFeedUser[]> {
  const listRes = await proxyRequest(deploymentId, PROXY_COMPONENT, 'users', {
    method: 'GET',
  })
  const fromList = parseSocialFeedUsers(listRes.body)
  if (fromList.length > 0) return fromList

  const poolRes = await proxyRequest(deploymentId, PROXY_COMPONENT, 'user-pool', {
    method: 'GET',
  })
  const ids = parseUserPoolIds(poolRes.body).slice(0, SF_USER_POOL_HYDRATE_LIMIT)
  if (ids.length === 0) return []

  const hydrated = await Promise.all(
    ids.map((id) => fetchSocialFeedUserById(deploymentId, id)),
  )
  return hydrated.filter((u): u is SocialFeedUser => u != null)
}

function extractCreatedSocialUser(body: unknown): SocialFeedUser | null {
  if (!body || typeof body !== 'object') return null
  const parsed = parseSocialFeedUsers(body)
  if (parsed[0]) return parsed[0]
  const u = body as Record<string, unknown>
  if (typeof u.id !== 'number') return null
  return {
    id: u.id,
    username:
      typeof u.username === 'string' && u.username.trim()
        ? u.username
        : `user-${u.id}`,
  }
}

function SocialFeedPlayground({
  deploymentId,
  open,
  dispatch,
  loadingAction,
  actionErrors,
}: {
  deploymentId: string | null
  open: boolean
  dispatch: PlaygroundDispatch
  loadingAction: string | null
  actionErrors: Record<string, string | null>
}) {
  const [sfUsers, setSfUsers] = useState<SocialFeedUser[]>([])
  const [sfLoading, setSfLoading] = useState(false)
  const [sfUsersError, setSfUsersError] = useState<string | null>(null)
  const [sfActiveUserId, setSfActiveUserId] = useState<number | null>(null)
  const [sfFollowTargetId, setSfFollowTargetId] = useState('')
  const [sfPostContent, setSfPostContent] = useState('')
  const [sfNewUsername, setSfNewUsername] = useState('')

  const fetchSfUsers = useCallback(async () => {
    if (!deploymentId) return
    setSfLoading(true)
    setSfUsersError(null)
    try {
      const users = await loadSocialFeedUsers(deploymentId)
      setSfUsers(users)
      setSfActiveUserId((prev) => {
        if (prev != null && users.some((u) => u.id === prev)) return prev
        return users[0]?.id ?? null
      })
    } catch (e) {
      setSfUsersError(e instanceof Error ? e.message : 'Failed to load users')
      setSfUsers([])
    } finally {
      setSfLoading(false)
    }
  }, [deploymentId])

  useEffect(() => {
    if (!open || !deploymentId) return
    void fetchSfUsers()
  }, [open, deploymentId, fetchSfUsers])

  const activeUser = sfUsers.find((u) => u.id === sfActiveUserId)
  const busy = loadingAction != null || sfLoading
  const followTarget = Number.parseInt(sfFollowTargetId, 10)

  return (
    <div className="space-y-3">
      <div>
        <SectionHeading>Acting as</SectionHeading>
        {sfLoading ? (
          <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--c9-muted)]">
            <Spinner /> Loading users…
          </p>
        ) : (
          <select
            value={sfActiveUserId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              setSfActiveUserId(Number.isFinite(id) ? id : null)
            }}
            disabled={busy || sfUsers.length === 0}
            className={`${fieldClass} mt-1`}
          >
            {sfUsers.length === 0 ? (
              <option value="">No users loaded</option>
            ) : (
              sfUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.username} (id {u.id})
                </option>
              ))
            )}
          </select>
        )}
        <ActionError message={sfUsersError} />
        {sfUsers.length === 0 && !sfLoading && !sfUsersError ? (
          <p className="mt-1 text-[10px] text-[var(--c9-muted)]">
            Create a user below or refresh after deploy finishes seeding.
          </p>
        ) : null}
      </div>

      <div>
        <SectionHeading>Post</SectionHeading>
        <textarea
          value={sfPostContent}
          onChange={(e) =>
            setSfPostContent(e.target.value.slice(0, SF_POST_MAX_CHARS))
          }
          rows={3}
          disabled={busy}
          placeholder="What's happening?"
          className={`${fieldClass} mt-1 resize-y`}
        />
        <p className="mt-0.5 text-right text-[10px] text-[var(--c9-muted)]">
          {sfPostContent.length}/{SF_POST_MAX_CHARS}
        </p>
        <button
          type="button"
          disabled={busy || !deploymentId || sfActiveUserId == null || !sfPostContent.trim()}
          className={`${actionBtnClass} mt-1`}
          onClick={() =>
            void dispatch(
              'sf-post',
              'POST /post',
              (requestId) =>
                proxyRequest(deploymentId!, PROXY_COMPONENT, 'post', {
                  method: 'POST',
                  body: { user_id: sfActiveUserId, content: sfPostContent.trim() },
                  requestId,
                }),
              () => setSfPostContent(''),
            )
          }
        >
          {loadingAction === 'sf-post' ? <Spinner /> : 'Post'}
        </button>
        <ActionError message={actionErrors['sf-post']} />
      </div>

      <div>
        <SectionHeading>Read feed</SectionHeading>
        <button
          type="button"
          disabled={busy || !deploymentId || sfActiveUserId == null}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('sf-feed', `GET /feed/${sfActiveUserId}`, (requestId) =>
              proxyRequest(
                deploymentId!,
                PROXY_COMPONENT,
                `feed/${sfActiveUserId}`,
                { method: 'GET', requestId },
              ),
            )
          }
        >
          {loadingAction === 'sf-feed' ? <Spinner /> : 'Read my feed'}
        </button>
        <ActionError message={actionErrors['sf-feed']} />
        {activeUser ? (
          <p className="mt-1 text-[10px] text-[var(--c9-muted)]">
            Timeline for @{activeUser.username}
          </p>
        ) : null}
      </div>

      <div>
        <SectionHeading>Follow / unfollow</SectionHeading>
        <input
          type="number"
          min={1}
          value={sfFollowTargetId}
          onChange={(e) => setSfFollowTargetId(e.target.value)}
          disabled={busy}
          placeholder="Target user id"
          className={`${fieldClass} mt-1`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              busy ||
              !deploymentId ||
              sfActiveUserId == null ||
              !Number.isFinite(followTarget) ||
              followTarget <= 0
            }
            className={actionBtnClass}
            onClick={() =>
              void dispatch('sf-follow', 'POST /follow', (requestId) =>
                proxyRequest(deploymentId!, PROXY_COMPONENT, 'follow', {
                  method: 'POST',
                  body: {
                    follower_id: sfActiveUserId,
                    following_id: followTarget,
                  },
                  requestId,
                }),
              )
            }
          >
            {loadingAction === 'sf-follow' ? <Spinner /> : 'Follow'}
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !deploymentId ||
              sfActiveUserId == null ||
              !Number.isFinite(followTarget) ||
              followTarget <= 0
            }
            className={actionBtnClass}
            onClick={() =>
              void dispatch('sf-unfollow', 'POST /unfollow', (requestId) =>
                proxyRequest(deploymentId!, PROXY_COMPONENT, 'unfollow', {
                  method: 'POST',
                  body: {
                    follower_id: sfActiveUserId,
                    following_id: followTarget,
                  },
                  requestId,
                }),
              )
            }
          >
            {loadingAction === 'sf-unfollow' ? <Spinner /> : 'Unfollow'}
          </button>
        </div>
        <ActionError message={actionErrors['sf-follow']} />
        <ActionError message={actionErrors['sf-unfollow']} />
      </div>

      <div>
        <SectionHeading>Create user</SectionHeading>
        <input
          type="text"
          value={sfNewUsername}
          onChange={(e) => setSfNewUsername(e.target.value)}
          disabled={busy}
          placeholder="username"
          className={`${fieldClass} mt-1`}
        />
        <button
          type="button"
          disabled={busy || !deploymentId || !sfNewUsername.trim()}
          className={`${actionBtnClass} mt-2`}
          onClick={() =>
            void dispatch(
              'sf-create-user',
              'POST /users',
              (requestId) =>
                proxyRequest(deploymentId!, PROXY_COMPONENT, 'users', {
                  method: 'POST',
                  body: { username: sfNewUsername.trim() },
                  requestId,
                }),
              (result) => {
                setSfNewUsername('')
                const created = extractCreatedSocialUser(result.body)
                void fetchSfUsers().then(() => {
                  if (created) setSfActiveUserId(created.id)
                })
              },
            )
          }
        >
          {loadingAction === 'sf-create-user' ? <Spinner /> : 'Create'}
        </button>
        <ActionError message={actionErrors['sf-create-user']} />
      </div>
    </div>
  )
}

/** Fixed timeline track — bar width is pixels within this, not % of the panel row. */
const TRACE_BAR_TRACK_PX = 72
/** Cap bar scaling so one huge duration_ms (e.g. full request span) cannot dominate. */
const TRACE_BAR_VISUAL_CAP_MS = 48
const TRACE_FALLBACK_DUR_MS = 12

function dedupeTraceLines(sorted: LogLine[], firstTs: number): LogLine[] {
  const seen = new Set<string>()
  const out: LogLine[] = []
  for (const line of sorted) {
    const offsetMs = new Date(line.timestamp).getTime() - firstTs
    const key = `${offsetMs}|${line.component}|${traceOpLabel(line)}|${traceOpDetail(line)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

interface TraceRowModel {
  line: LogLine
  offsetMs: number
  nextOffsetMs: number | null
}

function groupTraceRowsByComponent(
  rows: TraceRowModel[],
): { component: string; rows: TraceRowModel[] }[] {
  const groups: { component: string; rows: TraceRowModel[] }[] = []
  for (const row of rows) {
    const component = row.line.component || 'unknown'
    const last = groups[groups.length - 1]
    if (last?.component === component) last.rows.push(row)
    else groups.push({ component, rows: [row] })
  }
  return groups
}

function visualDurationMs(
  line: LogLine,
  offsetMs: number,
  nextOffsetMs: number | null,
): number {
  const logged = Number(line.fields?.duration_ms)
  const fromLog =
    Number.isFinite(logged) && logged > 0 ? Math.min(logged, TRACE_BAR_VISUAL_CAP_MS) : null
  if (fromLog != null) return fromLog
  if (nextOffsetMs != null) {
    return Math.min(
      TRACE_BAR_VISUAL_CAP_MS,
      Math.max(4, nextOffsetMs - offsetMs),
    )
  }
  return TRACE_FALLBACK_DUR_MS
}

function TraceWaterfallRow({
  row,
  maxDur,
}: {
  row: TraceRowModel
  maxDur: number
}) {
  const { line, offsetMs, nextOffsetMs } = row
  const logged = Number(line.fields?.duration_ms)
  const durationMs =
    Number.isFinite(logged) && logged > 0 ? logged : TRACE_FALLBACK_DUR_MS
  const visualMs = visualDurationMs(line, offsetMs, nextOffsetMs)
  const barPx = Math.min(
    TRACE_BAR_TRACK_PX,
    Math.max(4, Math.round((visualMs / maxDur) * TRACE_BAR_TRACK_PX)),
  )
  const detail = traceOpDetail(line)
  const label = traceOpLabel(line)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-9 shrink-0 text-right text-[var(--c9-muted)]">{offsetMs}ms</span>
      <span
        className="min-w-0 flex-1 truncate text-[var(--c9-text)]"
        title={`${label}${detail ? ` ${detail}` : ''}`}
      >
        {label}
        {detail ? <span className="text-[var(--c9-muted)]"> {detail}</span> : null}
      </span>
      <div
        className="relative h-3 shrink-0 overflow-hidden rounded-sm bg-[var(--c9-surface)]/80"
        style={{ width: TRACE_BAR_TRACK_PX }}
        title={
          Number.isFinite(logged) && logged > 0
            ? `${logged}ms (bar capped for display)`
            : `${durationMs}ms`
        }
      >
        <div
          className={`absolute left-0 top-0 h-3 max-w-full rounded-sm ${traceOpBarClass(line.message, line.fields)}`}
          style={{ width: barPx }}
        />
      </div>
    </div>
  )
}

function TraceWaterfall({ lines }: { lines: LogLine[] }) {
  const { groups, maxDur, isEmpty } = useMemo(() => {
    const sorted = [...lines].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    const first = sorted.length ? new Date(sorted[0].timestamp).getTime() : 0
    const deduped = dedupeTraceLines(sorted, first)
    const offsets = deduped.map((l) => new Date(l.timestamp).getTime() - first)
    const rows: TraceRowModel[] = deduped.map((line, i) => ({
      line,
      offsetMs: offsets[i]!,
      nextOffsetMs: i < offsets.length - 1 ? offsets[i + 1]! : null,
    }))
    let m = TRACE_FALLBACK_DUR_MS
    for (const row of rows) {
      const v = visualDurationMs(row.line, row.offsetMs, row.nextOffsetMs)
      if (v > m) m = v
    }
    return {
      groups: groupTraceRowsByComponent(rows),
      maxDur: m,
      isEmpty: rows.length === 0,
    }
  }, [lines])

  if (isEmpty) {
    return (
      <p className="py-4 text-center text-[11px] text-[var(--c9-muted)]">
        Waiting for trace logs…
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 p-2 font-mono text-[10px]">
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.component}>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
              {group.component}
            </p>
            <div className="space-y-1">
              {group.rows.map((row) => (
                <TraceWaterfallRow key={row.line.id} row={row} maxDur={maxDur} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={sectionTitleClass}>{children}</span>
      <div className="h-px flex-1 bg-[var(--c9-border)]" />
    </div>
  )
}

export function DataViewPanel({ open, onClose }: DataViewPanelProps) {
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const logs = useLogStore((s) => s.logs)
  const setActiveTraceId = useLogStore((s) => s.setActiveTraceId)

  const [activeTrace, setActiveTrace] = useState<string | null>(null)
  const [traceHistory, setTraceHistory] = useState<TraceEntry[]>([])
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [actionErrors, setActionErrors] = useState<Record<string, string | null>>({})
  const [shortenUrl, setShortenUrl] = useState('https://example.com/my-page')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [resolveCode, setResolveCode] = useState('')

  const waterfallRef = useRef<HTMLDivElement | null>(null)

  const templateTitle = templateTitleForId(snapshotTemplateId) ?? 'Template'

  useEffect(() => {
    if (lastCode) setResolveCode(lastCode)
  }, [lastCode])

  useEffect(() => {
    if (!open) {
      setActiveTrace(null)
      setActiveTraceId(null)
    }
  }, [open, setActiveTraceId])

  const traceLines = useMemo(() => {
    if (!activeTrace) return []
    return logs.filter((l) => l.fields?.request_id === activeTrace)
  }, [logs, activeTrace])

  const activeHistoryEntry = useMemo(
    () => traceHistory.find((t) => t.requestId === activeTrace),
    [traceHistory, activeTrace],
  )

  const selectTrace = useCallback(
    (requestId: string) => {
      setActiveTrace(requestId)
      setActiveTraceId(requestId)
      waterfallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [setActiveTraceId],
  )

  const handleClose = useCallback(() => {
    setActiveTraceId(null)
    setActiveTrace(null)
    onClose()
  }, [onClose, setActiveTraceId])

  const dispatch = useCallback(
    async (
      actionKey: string,
      label: string,
      run: (requestId: string) => Promise<ProxyResponse>,
      onSuccess?: (result: ProxyResponse) => void,
    ) => {
      if (!deploymentId) {
        setActionErrors((e) => ({ ...e, [actionKey]: 'No active deployment' }))
        return
      }
      const requestId = crypto.randomUUID()
      setActiveTrace(requestId)
      setActiveTraceId(requestId)
      setLoadingAction(actionKey)
      setActionErrors((e) => ({ ...e, [actionKey]: null }))
      const startedAt = Date.now()
      try {
        const result = await run(requestId)
        const durationMs = Date.now() - startedAt
        setTraceHistory((prev) =>
          [
            {
              requestId: result.requestId,
              label,
              startedAt,
              durationMs,
              status: result.status,
            },
            ...prev,
          ].slice(0, TRACE_HISTORY_MAX),
        )
        if (result.status >= 400) {
          const err =
            result.body &&
            typeof result.body === 'object' &&
            'error' in (result.body as object)
              ? String((result.body as { error?: unknown }).error)
              : `HTTP ${result.status}`
          setActionErrors((e) => ({ ...e, [actionKey]: err }))
        } else {
          onSuccess?.(result)
        }
      } catch (err) {
        setActionErrors((e) => ({
          ...e,
          [actionKey]: err instanceof Error ? err.message : 'Request failed',
        }))
      } finally {
        setLoadingAction(null)
      }
    },
    [deploymentId, setActiveTraceId],
  )

  const urlShortenerActions =
    snapshotTemplateId === 'url-shortener' ? (
      <div className="space-y-3">
        <div>
          <SectionHeading>Shorten a URL</SectionHeading>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={shortenUrl}
              onChange={(e) => setShortenUrl(e.target.value)}
              className={fieldClass}
              placeholder="https://example.com"
            />
            <button
              type="button"
              disabled={loadingAction != null || !deploymentId}
              className={`${actionBtnClass} shrink-0`}
              onClick={() =>
                void dispatch(
                  'shorten',
                  'POST /shorten',
                  (requestId) =>
                    proxyRequest(deploymentId!, PROXY_COMPONENT, 'shorten', {
                      method: 'POST',
                      body: { url: shortenUrl },
                      requestId,
                    }),
                  (result) => {
                    const code = extractShortCode(result.body)
                    if (code) setLastCode(code)
                  },
                )
              }
            >
              {loadingAction === 'shorten' ? <Spinner /> : 'Shorten'}
            </button>
          </div>
          <ActionError message={actionErrors.shorten} />
        </div>
        <div>
          <SectionHeading>Resolve a URL</SectionHeading>
          <p className="mb-2 text-[10px] text-[var(--c9-muted)]">
            Code: {lastCode ? 'from last shorten' : 'enter a short code'}
          </p>
          <input
            type="text"
            value={resolveCode}
            onChange={(e) => setResolveCode(e.target.value)}
            className={`${fieldClass} mb-2`}
            placeholder={lastCode ?? 'abc123'}
          />
          <button
            type="button"
            disabled={loadingAction != null || !deploymentId || !resolveCode.trim()}
            className={actionBtnClass}
            onClick={() => {
              const code = resolveCode.trim()
              void dispatch(
                'resolve',
                'GET /r/' + code,
                (requestId) =>
                  proxyRequest(deploymentId!, PROXY_COMPONENT, `r/${encodeURIComponent(code)}`, {
                    method: 'GET',
                    requestId,
                  }),
              )
            }}
          >
            {loadingAction === 'resolve' ? <Spinner /> : 'Resolve'}
          </button>
          <ActionError message={actionErrors.resolve} />
        </div>
      </div>
    ) : null

  const socialFeedActions =
    snapshotTemplateId === 'social-feed' ? (
      <SocialFeedPlayground
        deploymentId={deploymentId}
        open={open}
        dispatch={dispatch}
        loadingAction={loadingAction}
        actionErrors={actionErrors}
      />
    ) : null

  const ecommerceActions =
    snapshotTemplateId === 'ecommerce' ? (
      <div className="space-y-3">
        <button
          type="button"
          disabled={loadingAction != null || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('catalog', 'GET /catalog', (requestId) =>
              proxyRequest(deploymentId!, PROXY_COMPONENT, 'catalog', {
                method: 'GET',
                requestId,
              }),
            )
          }
        >
          {loadingAction === 'catalog' ? <Spinner /> : 'Browse catalog'}
        </button>
        <ActionError message={actionErrors.catalog} />
        <button
          type="button"
          disabled={loadingAction != null || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('checkout', 'POST /checkout', (requestId) =>
              proxyRequest(deploymentId!, PROXY_COMPONENT, 'checkout', {
                method: 'POST',
                body: { items: [{ product_id: 1, qty: 1 }] },
                requestId,
              }),
            )
          }
        >
          {loadingAction === 'checkout' ? <Spinner /> : 'Checkout'}
        </button>
        <ActionError message={actionErrors.checkout} />
      </div>
    ) : null

  const templateActions =
    urlShortenerActions ?? socialFeedActions ?? ecommerceActions ?? (
      <p className="text-[11px] text-[var(--c9-muted)]">
        No playground actions for this template yet.
      </p>
    )

  return (
    <aside
      className={`fixed top-0 left-0 z-[45] flex h-full w-80 flex-col border-r border-[var(--c9-border)] bg-[var(--c9-bg)]/95 text-[var(--c9-text)] shadow-xl backdrop-blur-sm transition-transform duration-200 ease-out ${
        open ? 'pointer-events-auto translate-x-0' : 'pointer-events-none -translate-x-full'
      }`}
      aria-hidden={!open}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--c9-border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--c9-text)]">
            <span aria-hidden>🎭 </span>
            Live Playground
          </p>
          <p className="text-xs text-[var(--c9-muted)]">{templateTitle}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded p-2 text-[var(--c9-muted)] transition-colors hover:bg-[var(--c9-badge-bg)] hover:text-[var(--c9-text)]"
          aria-label="Close playground"
        >
          ✕
        </button>
      </header>

      <div className="shrink-0 space-y-3 border-b border-[var(--c9-border)] p-4">
        {!deploymentId ? (
          <p className="rounded border border-amber-700/40 bg-amber-950/40 px-2 py-2 text-[11px] text-amber-100">
            Deploy or join a live session to dispatch requests.
          </p>
        ) : null}
        {templateActions}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div ref={waterfallRef} className="space-y-4">
          <div>
            <p className="mb-1 text-[11px] text-[var(--c9-muted)]">
              Trace:{' '}
              <span className="font-mono text-[var(--c9-text)]">
                {activeTrace ? `${activeTrace.slice(0, 8)}…` : '—'}
              </span>
            </p>
            <p className="mb-2 text-[10px] leading-snug text-[var(--c9-muted)]">
              Bars use log timestamps
              {activeHistoryEntry
                ? `; this request took ${activeHistoryEntry.durationMs}ms end-to-end via the proxy.`
                : '; history ms values are full proxy round-trip.'}{' '}
              Bar length uses capped duration_ms or time until the next log line.
            </p>
            <TraceWaterfall lines={traceLines} />
          </div>

          {traceHistory.length > 0 ? (
            <div className="border-t border-[var(--c9-border)] pt-4">
              <p className="mb-2 text-[11px] font-semibold text-[var(--c9-muted)]">
                Previous traces
              </p>
              <ul className="space-y-1">
                {traceHistory.map((t) => (
                  <li key={`${t.requestId}-${t.startedAt}`}>
                    <button
                      type="button"
                      onClick={() => selectTrace(t.requestId)}
                      className={`w-full rounded px-2 py-1 text-left font-mono text-[10px] transition-colors hover:bg-[var(--c9-surface)] ${
                        activeTrace === t.requestId
                          ? 'bg-[var(--c9-surface)] text-[var(--c9-accent)]'
                          : 'text-[var(--c9-muted)]'
                      }`}
                    >
                      · {t.requestId.slice(0, 8)} — {t.label} — {t.durationMs}ms
                      {t.status >= 400 ? (
                        <span className="text-red-400"> ({t.status})</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
