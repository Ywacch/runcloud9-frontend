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

function traceOpBarClass(message: string, fields?: Record<string, unknown>): string {
  const op = String(fields?.operation ?? fields?.op ?? message).toLowerCase()
  if (op.includes('cache') || op.includes('redis')) return 'bg-cyan-500'
  if (op.includes('db') || op.includes('sql') || op.includes('postgres')) return 'bg-amber-500'
  if (op.includes('mq') || op.includes('rabbit') || op.includes('queue')) return 'bg-violet-500'
  return 'bg-[var(--c9-accent)]'
}

function traceOpLabel(line: LogLine): string {
  const msg = line.message.trim()
  const op = line.fields?.operation ?? line.fields?.op
  if (typeof op === 'string' && op) return op
  const m = msg.match(/\b(cache_\w+|db_\w+|mq_\w+)\b/i)
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

function TraceWaterfall({ lines }: { lines: LogLine[] }) {
  const sorted = useMemo(
    () =>
      [...lines].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [lines],
  )

  const firstTs = sorted.length
    ? new Date(sorted[0].timestamp).getTime()
    : 0

  const maxDur = useMemo(() => {
    let m = 1
    for (const l of sorted) {
      const d = Number(l.fields?.duration_ms)
      if (Number.isFinite(d) && d > m) m = d
    }
    return m
  }, [sorted])

  if (sorted.length === 0) {
    return (
      <p className="py-4 text-center text-[11px] text-[var(--c9-muted)]">
        Waiting for trace logs…
      </p>
    )
  }

  return (
    <div className="space-y-1.5 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 p-2 font-mono text-[10px]">
      {sorted.map((line) => {
        const offsetMs = new Date(line.timestamp).getTime() - firstTs
        const dur = Number(line.fields?.duration_ms)
        const durationMs = Number.isFinite(dur) && dur > 0 ? dur : 12
        const widthPct = Math.min(100, Math.max(12, (durationMs / maxDur) * 100))
        const detail = traceOpDetail(line)
        return (
          <div key={line.id} className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-right text-[var(--c9-muted)]">
              {offsetMs}ms
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <div
                className={`h-3 shrink-0 rounded-sm ${traceOpBarClass(line.message, line.fields)}`}
                style={{ width: `${widthPct}%`, minWidth: '1.25rem' }}
                title={`${durationMs}ms`}
              />
              <span className="min-w-0 truncate text-[var(--c9-text)]">
                {traceOpLabel(line)}
                {detail ? (
                  <span className="text-[var(--c9-muted)]"> {detail}</span>
                ) : null}
              </span>
            </div>
          </div>
        )
      })}
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
  const [loading, setLoading] = useState(false)
  const [, setLastResult] = useState<ProxyResponse | null>(null)
  const [shortenUrl, setShortenUrl] = useState('https://example.com/my-page')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [resolveCode, setResolveCode] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const waterfallRef = useRef<HTMLDivElement | null>(null)

  const templateTitle = templateTitleForId(snapshotTemplateId) ?? 'Template'

  useEffect(() => {
    if (lastCode) setResolveCode(lastCode)
  }, [lastCode])

  const traceLines = useMemo(() => {
    if (!activeTrace) return []
    return logs.filter((l) => l.fields?.request_id === activeTrace)
  }, [logs, activeTrace])

  const selectTrace = useCallback(
    (requestId: string) => {
      setActiveTrace(requestId)
      setActiveTraceId(requestId)
      waterfallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [setActiveTraceId],
  )

  const dispatch = useCallback(
    async (
      label: string,
      run: (requestId: string) => Promise<ProxyResponse>,
      onSuccess?: (result: ProxyResponse) => void,
    ) => {
      if (!deploymentId) {
        setActionError('No active deployment')
        return
      }
      const requestId = crypto.randomUUID()
      setActiveTrace(requestId)
      setActiveTraceId(requestId)
      setLoading(true)
      setActionError(null)
      const startedAt = Date.now()
      try {
        const result = await run(requestId)
        setLastResult(result)
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
          ].slice(0, 30),
        )
        if (result.status >= 400) {
          const err =
            result.body &&
            typeof result.body === 'object' &&
            'error' in (result.body as object)
              ? String((result.body as { error?: unknown }).error)
              : `HTTP ${result.status}`
          setActionError(err)
        } else {
          onSuccess?.(result)
        }
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        setLoading(false)
      }
    },
    [deploymentId, setActiveTraceId],
  )

  const urlShortenerActions =
    snapshotTemplateId === 'url-shortener' ? (
      <div className="space-y-4">
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
              disabled={loading || !deploymentId}
              className={`${actionBtnClass} shrink-0`}
              onClick={() =>
                void dispatch(
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
              {loading ? <Spinner /> : 'Shorten'}
            </button>
          </div>
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
            disabled={loading || !deploymentId || !resolveCode.trim()}
            className={actionBtnClass}
            onClick={() => {
              const code = resolveCode.trim()
              void dispatch('GET /r/' + code, (requestId) =>
                proxyRequest(deploymentId!, PROXY_COMPONENT, `r/${encodeURIComponent(code)}`, {
                  method: 'GET',
                  requestId,
                }),
              )
            }}
          >
            {loading ? <Spinner /> : 'Resolve'}
          </button>
        </div>
      </div>
    ) : null

  const socialFeedActions =
    snapshotTemplateId === 'social-feed' ? (
      <div className="space-y-3">
        <button
          type="button"
          disabled={loading || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('POST /post', async (requestId) => {
              let userId = 1
              try {
                const pool = await proxyRequest(
                  deploymentId!,
                  PROXY_COMPONENT,
                  'user-pool',
                  { method: 'GET', requestId: crypto.randomUUID() },
                )
                const body = pool.body
                if (Array.isArray(body) && body.length > 0) {
                  const first = body[0] as Record<string, unknown>
                  if (typeof first.id === 'number') userId = first.id
                  else if (typeof first.user_id === 'number') userId = first.user_id
                }
              } catch {
                /* use default user_id */
              }
              return proxyRequest(deploymentId!, PROXY_COMPONENT, 'post', {
                method: 'POST',
                body: {
                  user_id: userId,
                  content: `Hello from the playground! ${Date.now()}`,
                },
                requestId,
              })
            })
          }
        >
          {loading ? <Spinner /> : 'Post as @alice'}
        </button>
        <button
          type="button"
          disabled={loading || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('GET /feed/1', (requestId) =>
              proxyRequest(deploymentId!, PROXY_COMPONENT, 'feed/1', {
                method: 'GET',
                requestId,
              }),
            )
          }
        >
          {loading ? <Spinner /> : 'Read feed'}
        </button>
      </div>
    ) : null

  const ecommerceActions =
    snapshotTemplateId === 'ecommerce' ? (
      <div className="space-y-3">
        <button
          type="button"
          disabled={loading || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('GET /catalog', (requestId) =>
              proxyRequest(deploymentId!, PROXY_COMPONENT, 'catalog', {
                method: 'GET',
                requestId,
              }),
            )
          }
        >
          {loading ? <Spinner /> : 'Browse catalog'}
        </button>
        <button
          type="button"
          disabled={loading || !deploymentId}
          className={actionBtnClass}
          onClick={() =>
            void dispatch('POST /checkout', (requestId) =>
              proxyRequest(deploymentId!, PROXY_COMPONENT, 'checkout', {
                method: 'POST',
                body: { items: [{ product_id: 1, qty: 1 }] },
                requestId,
              }),
            )
          }
        >
          {loading ? <Spinner /> : 'Checkout'}
        </button>
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
      className={`fixed top-0 left-0 z-30 flex h-full w-80 flex-col border-r border-[var(--c9-border)] bg-[var(--c9-bg)]/95 text-[var(--c9-text)] shadow-xl backdrop-blur-sm transition-transform duration-200 ease-out ${
        open ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
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
          onClick={onClose}
          className="shrink-0 rounded p-2 text-[var(--c9-muted)] transition-colors hover:bg-[var(--c9-badge-bg)] hover:text-[var(--c9-text)]"
          aria-label="Close playground"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {!deploymentId ? (
            <p className="rounded border border-amber-700/40 bg-amber-950/40 px-2 py-2 text-[11px] text-amber-100">
              Deploy or join a live session to dispatch requests.
            </p>
          ) : null}

          {actionError ? (
            <div className="rounded border border-red-700/50 bg-red-950/65 px-2 py-2 text-[11px] text-red-100">
              {actionError}
            </div>
          ) : null}

          {templateActions}

          <div ref={waterfallRef} className="border-t border-[var(--c9-border)] pt-4">
            <p className="mb-2 text-[11px] text-[var(--c9-muted)]">
              Trace:{' '}
              <span className="font-mono text-[var(--c9-text)]">
                {activeTrace ? `${activeTrace.slice(0, 8)}…` : '—'}
              </span>
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
