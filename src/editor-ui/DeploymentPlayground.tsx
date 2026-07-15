import { useCallback, useMemo, useState } from 'react'
import { deploymentProxyUrl } from '../lib/api'
import { cacheHasBrowserHttpProxy } from '../lib/proxyTargets'
import { useCanvasStore } from '../editor-core/stores/canvasStore'

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

  const cacheHttp = useMemo(() => cacheHasBrowserHttpProxy(nodes), [nodes])

  const urlPreview = useMemo(() => {
    if (!deploymentId) return ''
    return deploymentProxyUrl(deploymentId, target, pathInput)
  }, [deploymentId, target, pathInput])

  const applyUrlShortenerPreset = useCallback(() => {
    setTarget('app-server')
    setMethod('POST')
    setPathInput('shorten')
    setPostBody(JSON.stringify({ url: 'https://example.com' }, null, 2))
  }, [])

  const send = useCallback(async () => {
    if (!deploymentId) return
    setBusy(true)
    setLastError(null)
    setLastBody(null)
    setLastStatus(null)
    setLastProxied(null)
    try {
      const url = deploymentProxyUrl(deploymentId, target, pathInput)
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      let body: string | undefined
      if (method === 'POST' && postBody.trim() !== '') {
        headers['Content-Type'] = 'application/json'
        body = postBody
      }
      const res = await fetch(url, { method, headers, body })
      setLastStatus(res.status)
      setLastProxied(getProxiedHeaderValue(res))
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
  }, [deploymentId, method, pathInput, postBody, target])

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
                uses Redis-only (port 6379) — not HTTP. Use write-through /
                write-behind for an HTTP sidecar on the proxy.
              </p>
            ) : null}
          </div>

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
            placeholder="e.g. shorten or abc123"
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
                      {PROXIED_HEADER_LABEL}: {lastProxied || '—'}
                    </span>
                  </>
                ) : null}
              </p>
              {lastBody != null ? (
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
