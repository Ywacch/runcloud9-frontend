import { useCallback, useEffect, useMemo, useState } from 'react'
import { deploymentProxyUrl } from '../lib/api'
import {
  fetchDeploymentProxy,
  isSocialFeedTemplate,
  parseThreadServedBy,
  parseUserPoolUserIds,
} from '../lib/playgroundProxy'
import { cacheHasBrowserHttpProxy } from '../lib/proxyTargets'
import {
  buildThreadView,
  parseThreadPoolEntries,
  threadPoolOptionLabel,
  threadProxyArgs,
  tryParseThreadResponse,
  type ThreadPoolEntry,
  type ThreadView,
  type ThreadViewNode,
} from '../lib/threadView'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { FMT_EMPTY } from '../lib/format'

/** Whether the response was proxied through the API (supports legacy header name). */
function getProxiedHeaderValue(res: Response): string | null {
  return res.headers.get('X-RunCloud9-Proxied') ?? res.headers.get('X-Cloud9-Proxied')
}

const PROXIED_HEADER_LABEL = 'X-RunCloud9-Proxied'

type ProxyTarget = 'app-server' | 'lb' | 'mq' | 'cache'

export function DeploymentPlayground() {
  const mode = useCanvasStore((s) => s.mode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)

  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<ProxyTarget>('app-server')
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [pathInput, setPathInput] = useState('')
  const [postBody, setPostBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastStatus, setLastStatus] = useState<number | null>(null)
  const [lastProxied, setLastProxied] = useState<string | null>(null)
  const [lastBody, setLastBody] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)

  const [poolUserIds, setPoolUserIds] = useState<string[]>([])
  const [poolLoadError, setPoolLoadError] = useState<string | null>(null)
  const [actAsUserId, setActAsUserId] = useState('')
  const [threadRootId, setThreadRootId] = useState('')
  const [threadPool, setThreadPool] = useState<ThreadPoolEntry[]>([])
  const [threadPoolNotice, setThreadPoolNotice] = useState<string | null>(null)
  const [showThreadRaw, setShowThreadRaw] = useState(false)

  const cacheHttp = useMemo(() => cacheHasBrowserHttpProxy(nodes), [nodes])
  const socialFeed = isSocialFeedTemplate(snapshotTemplateId)

  const urlPreview = useMemo(() => {
    if (!deploymentId) return ''
    return deploymentProxyUrl(deploymentId, target, pathInput)
  }, [deploymentId, target, pathInput])

  const threadView = useMemo((): ThreadView | null => {
    if (!lastBody || lastStatus !== 200) return null
    const parsed = tryParseThreadResponse(lastBody)
    if (!parsed) return null
    return buildThreadView(parsed, Date.now())
  }, [lastBody, lastStatus])

  const servedBy = useMemo(() => {
    if (threadView) {
      const { servedByReplies, servedByParents } = threadView
      if (!servedByReplies && !servedByParents) return null
      return { replies: servedByReplies, parents: servedByParents }
    }
    return lastBody ? parseThreadServedBy(lastBody) : null
  }, [lastBody, threadView])

  useEffect(() => {
    if (!open || !deploymentId || !socialFeed) {
      setPoolUserIds([])
      setPoolLoadError(null)
      setThreadPool([])
      setThreadPoolNotice(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchDeploymentProxy(deploymentId, 'app-server', 'user-pool', {
          method: 'GET',
        })
        const text = await res.text()
        let body: unknown = null
        try {
          body = JSON.parse(text) as unknown
        } catch {
          /* ignore */
        }
        if (cancelled) return
        if (!res.ok) {
          setPoolLoadError(parseProxyLayerErrorMessage(text, res.statusText))
          setPoolUserIds([])
          return
        }
        setPoolLoadError(null)
        setPoolUserIds(parseUserPoolUserIds(body))
      } catch (e) {
        if (!cancelled) {
          setPoolLoadError(e instanceof Error ? e.message : 'Failed to load user pool')
          setPoolUserIds([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, deploymentId, socialFeed])

  useEffect(() => {
    if (!open || !deploymentId || !socialFeed) return
    let cancelled = false
    void (async () => {
      const args = threadProxyArgs('thread-pool', actAsUserId)
      try {
        const res = await fetchDeploymentProxy(deploymentId, 'app-server', args.path, {
          method: 'GET',
          actAsUserId: args.actAsUserId,
        })
        const text = await res.text()
        if (cancelled) return
        if (res.status === 404) {
          setThreadPool([])
          setThreadPoolNotice("Thread list isn't on this image yet.")
          return
        }
        if (!res.ok) {
          setThreadPool([])
          setThreadPoolNotice(parseProxyLayerErrorMessage(text, res.statusText))
          return
        }
        let body: unknown = null
        try {
          body = JSON.parse(text) as unknown
        } catch {
          setThreadPool([])
          setThreadPoolNotice('Invalid thread pool response')
          return
        }
        const entries = parseThreadPoolEntries(body)
        setThreadPool(entries)
        setThreadPoolNotice(
          entries.length === 0 ? 'No threads with replies yet.' : null,
        )
      } catch (e) {
        if (!cancelled) {
          setThreadPool([])
          setThreadPoolNotice(e instanceof Error ? e.message : 'Failed to load threads')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, deploymentId, socialFeed, actAsUserId])

  const loadThread = useCallback(
    async (root: string) => {
      const trimmed = root.trim().replace(/^\/+/, '')
      if (!trimmed || !/^\d+$/.test(trimmed)) {
        setLastError('Enter a numeric thread root id')
        return
      }
      if (!deploymentId) return
      setTarget('app-server')
      setMethod('GET')
      setPathInput(`threads/${trimmed}`)
      setPostBody('')
      setBusy(true)
      setLastError(null)
      setLastBody(null)
      setLastStatus(null)
      setLastProxied(null)
      setLastRequestId(null)
      setShowThreadRaw(false)
      try {
        const args = threadProxyArgs(`threads/${trimmed}`, actAsUserId)
        const res = await fetchDeploymentProxy(deploymentId, 'app-server', args.path, {
          method: 'GET',
          actAsUserId: args.actAsUserId,
        })
        setLastStatus(res.status)
        setLastProxied(getProxiedHeaderValue(res))
        setLastRequestId(res.headers.get('X-Request-ID'))
        const text = await res.text()
        if (!res.ok && getProxiedHeaderValue(res) !== 'true') {
          setLastError(parseProxyLayerErrorMessage(text, res.statusText))
        }
        setLastBody(text)
      } catch (e) {
        setLastError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        setBusy(false)
      }
    },
    [actAsUserId, deploymentId],
  )

  const applyUrlShortenerPreset = useCallback(() => {
    setTarget('app-server')
    setMethod('POST')
    setPathInput('shorten')
    setPostBody(JSON.stringify({ url: 'https://example.com' }, null, 2))
  }, [])

  const runThreadQuickAction = useCallback(async () => {
    await loadThread(threadRootId)
  }, [loadThread, threadRootId])

  const refreshThread = useCallback(async () => {
    await loadThread(threadRootId)
  }, [loadThread, threadRootId])

  const send = useCallback(async () => {
    if (!deploymentId) return
    setBusy(true)
    setLastError(null)
    setLastBody(null)
    setLastStatus(null)
    setLastProxied(null)
    setLastRequestId(null)
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      let body: string | undefined
      if (method === 'POST' && postBody.trim() !== '') {
        headers['Content-Type'] = 'application/json'
        body = postBody
      }
      const res = await fetchDeploymentProxy(deploymentId, target, pathInput, {
        method,
        headers,
        body,
        actAsUserId: actAsUserId.trim() || undefined,
      })
      setLastStatus(res.status)
      setLastProxied(getProxiedHeaderValue(res))
      setLastRequestId(res.headers.get('X-Request-ID'))
      const text = await res.text()
      const isLikelyProxyLayerError =
        getProxiedHeaderValue(res) !== 'true' &&
        (res.status === 400 ||
          res.status === 404 ||
          res.status === 405 ||
          res.status === 410 ||
          res.status === 502 ||
          res.status === 503)
      if (!res.ok && isLikelyProxyLayerError) {
        setLastError(parseProxyLayerErrorMessage(text, res.statusText))
        setLastBody(text || null)
        return
      }
      setLastBody(text)
      if (!res.ok && !text) {
        setLastError(res.statusText || `HTTP ${res.status}`)
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }, [actAsUserId, deploymentId, method, pathInput, postBody, target])

  if (mode !== 'live' || !deploymentId) return null

  return (
    <div className="pointer-events-auto absolute right-4 bottom-4 z-30 max-w-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-3 py-2 text-xs font-medium text-[var(--c9-text)] shadow-lg backdrop-blur-sm transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
      >
        {open ? 'Hide' : 'Try deployment API'}
      </button>
      {open ? (
        <div className="mt-2 max-h-[min(70vh,520px)] overflow-y-auto rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 p-3 text-xs text-[var(--c9-text)] shadow-xl backdrop-blur-sm">
          <p className="mb-2 text-[11px] leading-snug text-[var(--c9-muted)]">
            Proxied through the dashboard API (same origin as metrics). Only
            HTTP-friendly targets; PostgreSQL and Redis wire ports are not usable
            from the browser.
          </p>

          <div className="mb-2 space-y-1 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 p-2 text-[11px] text-[var(--c9-muted)]">
            <p>
              <span className="text-[var(--c9-text)]">Not exposed here:</span> Database
              (Postgres protocol), worker (no HTTP service).
            </p>
            {!cacheHttp ? (
              <p>
                <span className="text-[var(--c9-text)]">Cache:</span> current design
                uses Redis-only (port 6379), not HTTP. Use write-through /
                write-behind for an HTTP sidecar on the proxy.
              </p>
            ) : null}
          </div>

          {socialFeed ? (
            <>
              <label className="mb-1 block text-[var(--c9-muted)]">Act as</label>
              <select
                value={actAsUserId}
                onChange={(e) => setActAsUserId(e.target.value)}
                className="mb-1 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 text-[var(--c9-text)]"
              >
                <option value="">Me (owner)</option>
                {poolUserIds.map((id) => (
                  <option key={id} value={id}>
                    User {id}
                  </option>
                ))}
              </select>
              {poolLoadError ? (
                <p className="mb-2 text-[11px] text-amber-200/90">{poolLoadError}</p>
              ) : null}
              <label className="mb-1 block text-[var(--c9-muted)]">Thread</label>
              <select
                value={threadPool.some((e) => String(e.rootId) === threadRootId) ? threadRootId : ''}
                onChange={(e) => {
                  const id = e.target.value
                  setThreadRootId(id)
                  if (id) void loadThread(id)
                }}
                className="mb-1 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 text-[var(--c9-text)]"
              >
                <option value="">Pick a thread…</option>
                {threadPool.map((entry) => (
                  <option key={entry.rootId} value={String(entry.rootId)}>
                    {threadPoolOptionLabel(entry.rootId, entry.replyCount)}
                  </option>
                ))}
              </select>
              {threadPoolNotice ? (
                <p className="mb-2 text-[11px] text-[var(--c9-muted)]">{threadPoolNotice}</p>
              ) : null}
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={threadRootId}
                  onChange={(e) => setThreadRootId(e.target.value)}
                  placeholder="Thread root id"
                  className="min-w-0 flex-1 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 font-mono text-[var(--c9-text)]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runThreadQuickAction()}
                  className="shrink-0 rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-2 py-1.5 text-[11px] text-[var(--c9-badge-text)] disabled:opacity-50"
                >
                  Thread
                </button>
                <button
                  type="button"
                  disabled={busy || !threadRootId.trim()}
                  onClick={() => void refreshThread()}
                  className="shrink-0 rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-2 py-1.5 text-[11px] text-[var(--c9-badge-text)] disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </>
          ) : null}

          {snapshotTemplateId === 'url-shortener' ? (
            <button
              type="button"
              onClick={applyUrlShortenerPreset}
              className="mb-2 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-2 py-1.5 text-left text-[11px] text-[var(--c9-badge-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]/80"
            >
              Preset: POST /shorten (URL shortener)
            </button>
          ) : null}

          <label className="mb-1 block text-[var(--c9-muted)]">Target</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as ProxyTarget)}
            className="mb-2 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 text-[var(--c9-text)]"
          >
            <option value="app-server">app-server (app API)</option>
            <option value="lb">lb (load balancer :80)</option>
            <option value="mq">mq (RabbitMQ management HTTP :15672)</option>
            {cacheHttp ? (
              <option value="cache">cache (HTTP sidecar :8081)</option>
            ) : null}
          </select>

          <label className="mb-1 block text-[var(--c9-muted)]">
            Path after proxy (optional)
          </label>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="e.g. shorten or threads/42"
            className="mb-2 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 font-mono text-[var(--c9-text)]"
          />

          <label className="mb-1 block text-[var(--c9-muted)]">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
            className="mb-2 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 text-[var(--c9-text)]"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          {method === 'POST' ? (
            <>
              <label className="mb-1 block text-[var(--c9-muted)]">Body (JSON)</label>
              <textarea
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                rows={5}
                className="mb-2 w-full resize-y rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 font-mono text-[var(--c9-text)]"
              />
            </>
          ) : null}

          <p className="mb-2 break-all font-mono text-[10px] text-[var(--c9-muted)]">
            {urlPreview}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="w-full rounded bg-[var(--c9-accent)] px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>

          {lastError ? (
            <p className="mt-2 rounded bg-red-950/80 px-2 py-1 text-red-200">
              {lastError}
            </p>
          ) : null}

          {lastStatus != null ? (
            <div className="mt-2 space-y-1 border-t border-[var(--c9-border)] pt-2">
              <p className="text-[var(--c9-muted)]">
                Status:{' '}
                <span className="font-mono text-[var(--c9-text)]">{lastStatus}</span>
                {lastProxied != null ? (
                  <>
                    {' '}
                    ·{' '}
                    <span className="font-mono text-[var(--c9-text)]">
                      {PROXIED_HEADER_LABEL}: {lastProxied || FMT_EMPTY}
                    </span>
                  </>
                ) : null}
              </p>
              {lastRequestId ? (
                <p className="text-[11px] text-[var(--c9-muted)]">
                  Request id:{' '}
                  <span className="font-mono text-[var(--c9-text)]">{lastRequestId}</span>
                </p>
              ) : null}
              {servedBy ? (
                <p className="rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 px-2 py-1 text-[11px] text-[var(--c9-text)]">
                  Replies from{' '}
                  <span className="font-mono">{servedBy.replies ?? '—'}</span>
                  {' · '}
                  parents from{' '}
                  <span className="font-mono">{servedBy.parents ?? '—'}</span>
                </p>
              ) : null}
              {lastBody != null && threadView ? (
                <div className="max-h-48 overflow-auto rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 p-2 text-[11px] text-[var(--c9-text)]">
                  <ThreadCommentTree view={threadView} />
                  <details
                    className="mt-2 border-t border-[var(--c9-border)] pt-2"
                    open={showThreadRaw}
                    onToggle={(e) => setShowThreadRaw(e.currentTarget.open)}
                  >
                    <summary className="cursor-pointer text-[var(--c9-muted)]">Raw</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px]">
                      {tryPrettyJson(lastBody)}
                    </pre>
                  </details>
                </div>
              ) : null}
              {lastBody != null && !threadView ? (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 p-2 font-mono text-[11px] text-[var(--c9-text)]">
                  {tryPrettyJson(lastBody)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ThreadCommentTree({ view }: { view: ThreadView }) {
  return (
    <div>
      <ThreadCommentNode node={view.root} />
      {view.replyCount === 0 && !view.root.missing ? (
        <p className="mt-1 text-[var(--c9-muted)]">No replies yet</p>
      ) : null}
    </div>
  )
}

function ThreadCommentNode({ node }: { node: ThreadViewNode }) {
  return (
    <div style={{ marginLeft: node.depth * 16 }}>
      <p className="whitespace-pre-wrap break-words">{node.content}</p>
      {!node.missing && node.userId != null ? (
        <p className="text-[10px] text-[var(--c9-muted)]">
          user {node.userId}
          {node.ageLabel ? ` · ${node.ageLabel}` : ''}
        </p>
      ) : null}
      {node.children.map((child) => (
        <ThreadCommentNode key={`${child.id}-${child.depth}`} node={child} />
      ))}
    </div>
  )
}

function tryPrettyJson(text: string): string {
  try {
    const v = JSON.parse(text) as unknown
    return JSON.stringify(v, null, 2)
  } catch {
    return text
  }
}

/** Same shape as `readApiErrorMessage` for JSON `{ error }` from the proxy handler. */
function parseProxyLayerErrorMessage(text: string, statusText: string): string {
  if (!text) return statusText || 'Request failed'
  try {
    const j = JSON.parse(text) as { error?: string }
    if (typeof j.error === 'string') return j.error
  } catch {
    /* not JSON */
  }
  return text.slice(0, 400)
}
