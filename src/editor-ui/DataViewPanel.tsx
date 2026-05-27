import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { proxyRequest, type ProxyResponse } from '../lib/proxyApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useLogStore, type LogLine } from '../editor-core/stores/logStore'
import { templateTitleForId } from './TemplateModal'

const PROXY_COMPONENT = 'app-server'

const actionBtnClass =
  'rounded-md border border-[var(--c9-accent)]/40 bg-[var(--c9-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--c9-accent)] transition-[transform,background-color,border-color] duration-200 hover:border-[var(--c9-accent)]/60 hover:bg-[var(--c9-accent)]/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

const actionBtnGhostClass =
  'rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)]/80 px-2.5 py-1.5 text-xs font-medium text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-surface)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

const fieldClass =
  'w-full rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2.5 py-1.5 text-xs text-[var(--c9-text)] transition-colors focus:border-[var(--c9-accent)] focus:outline-none'

const sectionTitleClass =
  'text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]'

function PlaygroundSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--c9-border)]/90 bg-[var(--c9-surface)]/30">
      <div className="border-b border-[var(--c9-border)]/70 px-3 py-2">
        <h3 className="text-[11px] font-semibold tracking-tight text-[var(--c9-text)]">
          {title}
        </h3>
        {hint ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--c9-muted)]">{hint}</p>
        ) : null}
      </div>
      <div className="space-y-2.5 px-3 py-2.5">{children}</div>
    </section>
  )
}

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
  return msg
}

function traceOpDetail(line: LogLine): string {
  const f = line.fields ?? {}
  const parts: string[] = []
  if (f.key != null) parts.push(`key=${String(f.key)}`)
  if (f.hit != null) parts.push(String(f.hit) === 'true' || f.hit === true ? 'HIT' : 'MISS')
  if (f.result != null && f.hit == null) parts.push(String(f.result))
  if (f.table != null) parts.push(String(f.table))
  if (f.query != null) parts.push(String(f.query))
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
/** Max rows when filtering the in-memory sample; unfiltered shows every loaded user. */
const SF_PICKER_FILTER_MAX = 50
/** Max catalog rows rendered at once in the narrow playground panel. */
const EC_CATALOG_VISIBLE_MAX = 80

const labelClass = 'text-[10px] font-medium text-[var(--c9-muted)]'

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

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim())
  }
  return null
}

function parseCollectionTotal(body: unknown, fallback: number): number {
  if (!body || typeof body !== 'object') return fallback
  const o = body as Record<string, unknown>
  return (
    parsePositiveInt(o.count) ??
    parsePositiveInt(o.total) ??
    parsePositiveInt(o.size) ??
    parsePositiveInt(o.pool_size) ??
    parsePositiveInt(o.poolSize) ??
    parsePositiveInt(o.user_count) ??
    fallback
  )
}

function parseUserPoolIds(body: unknown): number[] {
  if (!body || typeof body !== 'object') return []
  const o = body as Record<string, unknown>
  if (!Array.isArray(o.userIds)) return []
  return (o.userIds as unknown[]).filter((id): id is number => typeof id === 'number')
}

async function fetchSocialFeedUserList(
  deploymentId: string,
): Promise<{ users: SocialFeedUser[]; listTotal: number }> {
  const res = await proxyRequest(deploymentId, PROXY_COMPONENT, 'users', { method: 'GET' })
  if (res.status >= 400) return { users: [], listTotal: 0 }
  const users = parseSocialFeedUsers(res.body)
  return {
    users,
    listTotal: parseCollectionTotal(res.body, users.length),
  }
}

/** Partial username search — up to 20 matches from GET /users?username= or ?q=. */
async function searchSocialFeedUsers(
  deploymentId: string,
  query: string,
): Promise<SocialFeedUser[]> {
  const encoded = encodeURIComponent(query.trim())
  for (const param of ['username', 'q'] as const) {
    const res = await proxyRequest(
      deploymentId,
      PROXY_COMPONENT,
      `users?${param}=${encoded}`,
      { method: 'GET' },
    )
    if (res.status >= 400) continue
    const users = parseSocialFeedUsers(res.body)
    if (users.length > 0) return users
  }
  return []
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

function mergeSocialFeedUsers(
  primary: SocialFeedUser[],
  extra: SocialFeedUser[],
): SocialFeedUser[] {
  const byId = new Map<number, SocialFeedUser>()
  for (const u of primary) byId.set(u.id, u)
  for (const u of extra) {
    if (!byId.has(u.id)) byId.set(u.id, u)
  }
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

async function loadSocialFeedUserDirectory(
  deploymentId: string,
): Promise<{ users: SocialFeedUser[]; poolSize: number; listTotal: number }> {
  const poolRes = await proxyRequest(deploymentId, PROXY_COMPONENT, 'user-pool', {
    method: 'GET',
  })
  const poolIds = parseUserPoolIds(poolRes.body)
  const poolTotal = parseCollectionTotal(
    poolRes.body,
    poolIds.length > 0 ? poolIds.length : 0,
  )

  const { users: fromList, listTotal } = await fetchSocialFeedUserList(deploymentId)

  return {
    users: fromList,
    listTotal,
    poolSize: poolTotal > 0 ? poolTotal : listTotal > 0 ? listTotal : fromList.length,
  }
}

async function lookupSocialFeedUser(
  deploymentId: string,
  query: string,
): Promise<SocialFeedUser | null> {
  const q = query.trim()
  if (!q) return null

  if (/^\d+$/.test(q)) {
    return fetchSocialFeedUserById(deploymentId, Number(q))
  }

  const matches = await searchSocialFeedUsers(deploymentId, q)
  if (matches.length === 0) return null
  const needle = q.toLowerCase()
  return (
    matches.find((u) => u.username.toLowerCase() === needle) ??
    matches[0] ??
    null
  )
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

interface CatalogProductRow {
  id: number
  name: string
  price: string
}

function parseCatalogProducts(body: unknown): CatalogProductRow[] {
  if (!body || typeof body !== 'object') return []
  const o = body as Record<string, unknown>
  const arr = Array.isArray(o.products) ? o.products : []
  const rows: CatalogProductRow[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const p = row as Record<string, unknown>
    const id =
      typeof p.id === 'number'
        ? p.id
        : typeof p.product_id === 'number'
          ? p.product_id
          : null
    if (id == null) continue
    const name = typeof p.name === 'string' ? p.name : `Product ${id}`
    let price = '—'
    if (typeof p.price === 'number' && Number.isFinite(p.price)) {
      price = p.price.toFixed(2)
    } else if (typeof p.price === 'string') {
      price = p.price
    }
    rows.push({ id, name, price })
  }
  return rows
}

function EcommercePlayground({
  deploymentId,
  dispatch,
  loadingAction,
  actionErrors,
}: {
  deploymentId: string | null
  dispatch: PlaygroundDispatch
  loadingAction: string | null
  actionErrors: Record<string, string | null>
}) {
  const [ecProductId, setEcProductId] = useState(1)
  const [ecQuantity, setEcQuantity] = useState(1)
  const [catalogRows, setCatalogRows] = useState<CatalogProductRow[] | null>(null)
  const [catalogFilter, setCatalogFilter] = useState('')

  const busy = loadingAction != null

  const catalogMatches = useMemo(() => {
    if (!catalogRows?.length) return []
    const q = catalogFilter.trim().toLowerCase()
    if (!q) return catalogRows
    return catalogRows.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q),
    )
  }, [catalogRows, catalogFilter])

  const catalogVisible = useMemo(
    () => catalogMatches.slice(0, EC_CATALOG_VISIBLE_MAX),
    [catalogMatches],
  )

  const catalogStatus = useMemo(() => {
    if (catalogRows == null) return null
    if (catalogRows.length === 0) return 'empty'
    const total = catalogRows.length
    const matchCount = catalogMatches.length
    const shown = catalogVisible.length
    if (matchCount === 0) return { kind: 'no_match' as const, total }
    if (shown < matchCount) {
      return {
        kind: 'truncated' as const,
        total,
        matchCount,
        shown,
        filtered: catalogFilter.trim().length > 0,
      }
    }
    if (catalogFilter.trim()) {
      return { kind: 'filtered' as const, total, matchCount }
    }
    return { kind: 'all' as const, total, matchCount }
  }, [catalogRows, catalogMatches, catalogVisible, catalogFilter])

  const clampPositive = (n: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1)

  return (
    <div className="space-y-2.5">
      <PlaygroundSection
        title="Catalog"
        hint="Browse loads the full catalog into memory. Filter by id or name, then click a row to set checkout product id."
      >
        <button
          type="button"
          disabled={busy || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch(
              'catalog',
              'GET /catalog',
              (requestId) =>
                proxyRequest(deploymentId!, PROXY_COMPONENT, 'catalog', {
                  method: 'GET',
                  requestId,
                }),
              (result) => {
                setCatalogRows(parseCatalogProducts(result.body))
                setCatalogFilter('')
              },
            )
          }
        >
          {loadingAction === 'catalog' ? <Spinner /> : 'Browse catalog'}
        </button>
        <ActionError message={actionErrors.catalog} />

        {catalogRows != null && catalogRows.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Filter products</span>
            <input
              type="search"
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
              disabled={busy}
              placeholder="id or name"
              className={fieldClass}
            />
          </label>
        ) : null}

        {catalogVisible.length > 0 ? (
          <div className="max-h-44 overflow-y-auto rounded-md border border-[var(--c9-border)]/80">
            <table className="w-full border-collapse font-mono text-[10px]">
              <thead className="sticky top-0 bg-[var(--c9-bg)]">
                <tr className="border-b border-[var(--c9-border)] text-left text-[var(--c9-muted)]">
                  <th className="px-2 py-1">id</th>
                  <th className="px-2 py-1">name</th>
                  <th className="px-2 py-1">price</th>
                </tr>
              </thead>
              <tbody>
                {catalogVisible.map((p) => (
                  <tr key={p.id}>
                    <td colSpan={3} className="p-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEcProductId(p.id)}
                        className={`grid w-full grid-cols-[2.5rem_1fr_3.5rem] gap-0 border-b border-[var(--c9-border)]/40 px-2 py-1 text-left transition-colors hover:bg-[var(--c9-surface)] active:scale-[0.99] ${
                          ecProductId === p.id
                            ? 'bg-[var(--c9-accent)]/10 text-[var(--c9-accent)]'
                            : 'text-[var(--c9-text)]'
                        }`}
                      >
                        <span>{p.id}</span>
                        <span className="truncate">{p.name}</span>
                        <span className="text-right text-[var(--c9-muted)]">{p.price}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : catalogStatus === 'empty' ? (
          <p className="text-[10px] text-[var(--c9-muted)]">Catalog returned no products.</p>
        ) : catalogStatus?.kind === 'no_match' ? (
          <p className="text-[10px] text-[var(--c9-muted)]">
            No products match &ldquo;{catalogFilter.trim()}&rdquo; ({catalogStatus.total}{' '}
            in catalog).
          </p>
        ) : null}

        {catalogStatus && catalogStatus !== 'empty' && catalogStatus.kind !== 'no_match' ? (
          <p className="text-[10px] text-[var(--c9-muted)]">
            {catalogStatus.kind === 'truncated'
              ? `Showing ${catalogStatus.shown} of ${catalogStatus.matchCount} matches${
                  catalogStatus.filtered ? '' : ` (${catalogStatus.total} total)`
                } — narrow your search to see more.`
              : catalogStatus.kind === 'filtered'
                ? `${catalogStatus.matchCount} of ${catalogStatus.total} products match.`
                : `${catalogStatus.matchCount} products loaded.`}
          </p>
        ) : null}
      </PlaygroundSection>

      <PlaygroundSection title="Checkout">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Product ID</span>
            <input
              type="number"
              min={1}
              value={ecProductId}
              onChange={(e) => setEcProductId(clampPositive(Number(e.target.value)))}
              disabled={busy}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Quantity</span>
            <input
              type="number"
              min={1}
              value={ecQuantity}
              onChange={(e) => setEcQuantity(clampPositive(Number(e.target.value)))}
              disabled={busy}
              className={fieldClass}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('checkout', 'POST /checkout', (requestId) =>
              proxyRequest(deploymentId!, PROXY_COMPONENT, 'checkout', {
                method: 'POST',
                body: { product_id: ecProductId, quantity: ecQuantity },
                requestId,
              }),
            )
          }
        >
          {loadingAction === 'checkout' ? <Spinner /> : 'Checkout'}
        </button>
        <ActionError message={actionErrors.checkout} />
      </PlaygroundSection>
    </div>
  )
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
  const [sfPoolSize, setSfPoolSize] = useState(0)
  const [sfListTotal, setSfListTotal] = useState(0)
  const [sfLoading, setSfLoading] = useState(false)
  const [sfUsersError, setSfUsersError] = useState<string | null>(null)
  const [sfActiveUserId, setSfActiveUserId] = useState<number | null>(null)
  const [sfUserQuery, setSfUserQuery] = useState('')
  const [sfLookupBusy, setSfLookupBusy] = useState(false)
  const [sfLookupError, setSfLookupError] = useState<string | null>(null)
  const [sfFollowTargetId, setSfFollowTargetId] = useState('')
  const [sfPostContent, setSfPostContent] = useState('')
  const [sfNewUsername, setSfNewUsername] = useState('')

  const fetchSfUsers = useCallback(async () => {
    if (!deploymentId) return
    setSfLoading(true)
    setSfUsersError(null)
    try {
      const { users, poolSize, listTotal } = await loadSocialFeedUserDirectory(deploymentId)
      setSfUsers(users)
      setSfPoolSize(poolSize)
      setSfListTotal(listTotal)
      setSfActiveUserId((prev) => {
        if (prev != null && users.some((u) => u.id === prev)) return prev
        return users[0]?.id ?? null
      })
    } catch (e) {
      setSfUsersError(e instanceof Error ? e.message : 'Failed to load users')
      setSfUsers([])
      setSfPoolSize(0)
      setSfListTotal(0)
    } finally {
      setSfLoading(false)
    }
  }, [deploymentId])

  useEffect(() => {
    if (!open || !deploymentId) return
    void fetchSfUsers()
  }, [open, deploymentId, fetchSfUsers])

  const activeUser = sfUsers.find((u) => u.id === sfActiveUserId)
  const busy = loadingAction != null || sfLoading || sfLookupBusy
  const followTarget = Number.parseInt(sfFollowTargetId, 10)

  const pickerMatches = useMemo(() => {
    const q = sfUserQuery.trim().toLowerCase()
    if (!q) return sfUsers
    const list = sfUsers.filter(
      (u) => u.username.toLowerCase().includes(q) || String(u.id).includes(q),
    )
    return list.slice(0, SF_PICKER_FILTER_MAX)
  }, [sfUsers, sfUserQuery])

  const pickerFiltered = sfUserQuery.trim().length > 0

  const addUserToCache = useCallback((user: SocialFeedUser) => {
    setSfUsers((prev) => mergeSocialFeedUsers(prev, [user]))
    setSfActiveUserId(user.id)
    setSfUserQuery(user.username)
    setSfLookupError(null)
  }, [])

  const resolveUser = useCallback(async () => {
    if (!deploymentId || !sfUserQuery.trim()) return
    setSfLookupBusy(true)
    setSfLookupError(null)
    try {
      const q = sfUserQuery.trim()
      if (/^\d+$/.test(q)) {
        const found = await lookupSocialFeedUser(deploymentId, q)
        if (found) addUserToCache(found)
        else setSfLookupError(`No user with id ${q}.`)
      } else {
        const matches = await searchSocialFeedUsers(deploymentId, q)
        if (matches.length === 0) {
          setSfLookupError(
            `No users matching "${q}". Search is partial and returns up to 20 matches.`,
          )
          return
        }
        setSfUsers((prev) => mergeSocialFeedUsers(prev, matches))
        const needle = q.toLowerCase()
        const pick =
          matches.find((u) => u.username.toLowerCase() === needle) ?? matches[0]!
        addUserToCache(pick)
      }
    } catch (e) {
      setSfLookupError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setSfLookupBusy(false)
    }
  }, [addUserToCache, deploymentId, sfUserQuery])

  const poolHint = (() => {
    if (sfPoolSize <= 0 && sfUsers.length === 0) {
      return 'Look up by numeric id or partial username (GET /users?username=, up to 20 matches).'
    }
    const poolPart =
      sfPoolSize > 0 ? `${sfPoolSize.toLocaleString()} users in the pool` : 'Users in the pool'
    const loadedPart =
      sfUsers.length > 0
        ? `${sfUsers.length} loaded for quick pick${
            sfListTotal > sfUsers.length
              ? ` (API page size ${sfListTotal.toLocaleString()})`
              : ''
          }`
        : 'none loaded yet'
    return `${poolPart}; ${loadedPart}. Look up by id or search username (partial match, max 20 results).`
  })()

  return (
    <div className="space-y-2.5">
      <PlaygroundSection title="Acting as" hint={poolHint}>
        {sfLoading ? (
          <div className="space-y-2">
            <div className="h-8 animate-pulse rounded-md bg-[var(--c9-surface)]" />
            <div className="h-8 w-2/3 animate-pulse rounded-md bg-[var(--c9-surface)]" />
          </div>
        ) : (
          <>
            {activeUser ? (
              <div className="rounded-md border border-[var(--c9-accent)]/35 bg-[var(--c9-accent)]/8 px-2.5 py-2">
                <p className="text-[10px] text-[var(--c9-muted)]">Current persona</p>
                <p className="font-mono text-xs text-[var(--c9-text)]">
                  @{activeUser.username}
                  <span className="text-[var(--c9-muted)]"> · id {activeUser.id}</span>
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--c9-muted)]">
                Look up a user to start posting and reading feeds.
              </p>
            )}

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>User id or username</span>
              <input
                type="text"
                value={sfUserQuery}
                onChange={(e) => {
                  setSfUserQuery(e.target.value)
                  setSfLookupError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void resolveUser()
                }}
                disabled={busy || !deploymentId}
                placeholder="id (847) or username (alice)"
                className={fieldClass}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !deploymentId || !sfUserQuery.trim()}
                className={actionBtnClass}
                onClick={() => void resolveUser()}
              >
                {sfLookupBusy ? <Spinner /> : 'Look up'}
              </button>
              <button
                type="button"
                disabled={busy || !deploymentId}
                className={actionBtnGhostClass}
                onClick={() => void fetchSfUsers()}
              >
                Refresh list
              </button>
            </div>
            <ActionError message={sfUsersError ?? sfLookupError} />

            {pickerMatches.length > 0 ? (
              <ul className="max-h-44 overflow-y-auto rounded-md border border-[var(--c9-border)]/80 divide-y divide-[var(--c9-border)]/60">
                {pickerMatches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => addUserToCache(u)}
                      className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--c9-surface)] active:scale-[0.99] ${
                        sfActiveUserId === u.id
                          ? 'bg-[var(--c9-accent)]/10 text-[var(--c9-accent)]'
                          : 'text-[var(--c9-text)]'
                      }`}
                    >
                      <span className="truncate font-medium">@{u.username}</span>
                      <span className="shrink-0 pl-2 font-mono text-[10px] text-[var(--c9-muted)]">
                        {u.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : sfUsers.length > 0 && pickerFiltered ? (
              <p className="text-[10px] text-[var(--c9-muted)]">
                No match in the {sfUsers.length} loaded users — use Look up for ids outside
                that page.
              </p>
            ) : null}
            {sfUsers.length > 0 && pickerFiltered && pickerMatches.length >= SF_PICKER_FILTER_MAX ? (
              <p className="text-[10px] text-[var(--c9-muted)]">
                Showing first {SF_PICKER_FILTER_MAX} filter matches — refine search or Look up.
              </p>
            ) : null}
            {sfUsers.length > 0 && !pickerFiltered && sfPoolSize > sfUsers.length ? (
              <p className="text-[10px] text-[var(--c9-muted)]">
                Quick pick only includes the users returned by GET /users (not the full pool).
              </p>
            ) : null}
          </>
        )}
      </PlaygroundSection>

      <PlaygroundSection title="Post">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Content</span>
          <textarea
            value={sfPostContent}
            onChange={(e) =>
              setSfPostContent(e.target.value.slice(0, SF_POST_MAX_CHARS))
            }
            rows={3}
            disabled={busy}
            placeholder="What's happening?"
            className={`${fieldClass} resize-y`}
          />
        </label>
        <p className="text-right text-[10px] text-[var(--c9-muted)]">
          {sfPostContent.length}/{SF_POST_MAX_CHARS}
        </p>
        <button
          type="button"
          disabled={busy || !deploymentId || sfActiveUserId == null || !sfPostContent.trim()}
          className={actionBtnClass}
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
      </PlaygroundSection>

      <PlaygroundSection
        title="Read feed"
        hint={
          activeUser
            ? `Timeline for @${activeUser.username}`
            : 'Select a persona above before loading a feed.'
        }
      >
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
      </PlaygroundSection>

      <PlaygroundSection title="Follow / unfollow">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Target user id</span>
          <input
            type="number"
            min={1}
            value={sfFollowTargetId}
            onChange={(e) => setSfFollowTargetId(e.target.value)}
            disabled={busy}
            placeholder="e.g. 847"
            className={fieldClass}
          />
        </label>
        <div className="flex flex-wrap gap-2">
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
      </PlaygroundSection>

      <PlaygroundSection title="Create user">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Username</span>
          <input
            type="text"
            value={sfNewUsername}
            onChange={(e) => setSfNewUsername(e.target.value)}
            disabled={busy}
            placeholder="new handle"
            className={fieldClass}
          />
        </label>
        <button
          type="button"
          disabled={busy || !deploymentId || !sfNewUsername.trim()}
          className={actionBtnClass}
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
                if (created) {
                  addUserToCache(created)
                } else {
                  void fetchSfUsers()
                }
              },
            )
          }
        >
          {loadingAction === 'sf-create-user' ? <Spinner /> : 'Create'}
        </button>
        <ActionError message={actionErrors['sf-create-user']} />
      </PlaygroundSection>
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
  const hasDetail = detail.length > 0
  const fullTitle = hasDetail ? `${label} — ${detail}` : label
  const barTitle =
    Number.isFinite(logged) && logged > 0
      ? `${logged}ms (bar capped for display)`
      : `${durationMs}ms`

  return (
    <div
      className="grid min-w-0 items-center gap-x-2 gap-y-0.5"
      style={{ gridTemplateColumns: '2.25rem minmax(0, 1fr) 4.5rem' }}
      title={fullTitle}
    >
      <span
        className={`col-start-1 row-start-1 tabular-nums text-right text-[var(--c9-muted)] ${
          hasDetail ? 'row-span-2 self-start pt-px' : 'self-center'
        }`}
      >
        {offsetMs}ms
      </span>

      {hasDetail ? (
        <>
          <span className="col-start-2 row-start-1 block min-w-0 truncate font-medium text-[var(--c9-text)]">
            {label}
          </span>
          <span className="col-start-2 row-start-2 block min-w-0 truncate text-[var(--c9-muted)]">
            {detail}
          </span>
        </>
      ) : (
        <span className="col-start-2 row-start-1 block min-w-0 truncate text-[var(--c9-text)]">
          {label}
        </span>
      )}

      <div
        className={`relative col-start-3 row-start-1 h-3 shrink-0 justify-self-end overflow-hidden rounded-sm bg-[var(--c9-surface)]/80 ${
          hasDetail ? 'row-span-2 self-center' : 'self-center'
        }`}
        style={{ width: TRACE_BAR_TRACK_PX }}
        title={barTitle}
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
      <EcommercePlayground
        deploymentId={deploymentId}
        dispatch={dispatch}
        loadingAction={loadingAction}
        actionErrors={actionErrors}
      />
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
          <p className="text-sm font-semibold tracking-tight text-[var(--c9-text)]">
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

      <div className="flex min-h-0 max-h-[48%] shrink-0 flex-col border-b border-[var(--c9-border)]">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!deploymentId ? (
            <p className="rounded border border-amber-700/40 bg-amber-950/40 px-2 py-2 text-[11px] text-amber-100">
              Deploy or join a live session to dispatch requests.
            </p>
          ) : null}
          {templateActions}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
              {activeHistoryEntry
                ? `${activeHistoryEntry.durationMs}ms proxy round-trip.`
                : 'Select a trace from history or run an action.'}{' '}
              Bar width uses capped duration_ms between log lines.
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
      </div>
    </aside>
  )
}
