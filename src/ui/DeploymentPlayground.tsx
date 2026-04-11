import { useCallback, useMemo, useState } from 'react'
import { deploymentProxyUrl } from '../lib/api'
import { cacheHasBrowserHttpProxy } from '../lib/proxyTargets'
import { useCanvasStore } from '../store/canvasStore'

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
      setLastProxied(res.headers.get('X-Cloud9-Proxied'))
      const text = await res.text()
      const isLikelyProxyLayerError =
        res.headers.get('X-Cloud9-Proxied') !== 'true' &&
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
        className="rounded-lg border border-gray-700/80 bg-gray-900/95 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm hover:bg-gray-800"
      >
        {open ? 'Hide' : 'Try deployment API'}
      </button>
      {open ? (
        <div className="mt-2 max-h-[min(70vh,520px)] overflow-y-auto rounded-lg border border-gray-700/80 bg-gray-900/95 p-3 text-xs text-gray-200 shadow-xl backdrop-blur-sm">
          <p className="mb-2 text-[11px] leading-snug text-gray-400">
            Proxied through the dashboard API (same origin as metrics). Only
            HTTP-friendly targets; PostgreSQL and Redis wire ports are not usable
            from the browser.
          </p>

          <div className="mb-2 space-y-1 rounded border border-gray-800 bg-gray-950/50 p-2 text-[11px] text-gray-500">
            <p>
              <span className="text-gray-400">Not exposed here:</span> Database
              (Postgres protocol), worker (no HTTP service).
            </p>
            {!cacheHttp ? (
              <p>
                <span className="text-gray-400">Cache:</span> current design
                uses Redis-only (port 6379) — not HTTP. Use write-through /
                write-behind / read-through for an HTTP sidecar on the proxy.
              </p>
            ) : null}
          </div>

          {snapshotTemplateId === 'url-shortener' ? (
            <button
              type="button"
              onClick={applyUrlShortenerPreset}
              className="mb-2 w-full rounded border border-blue-800/80 bg-blue-950/40 px-2 py-1.5 text-left text-[11px] text-blue-200 hover:bg-blue-900/40"
            >
              Preset: POST /shorten (URL shortener)
            </button>
          ) : null}

          <label className="mb-1 block text-gray-400">Target</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as ProxyTarget)}
            className="mb-2 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-white"
          >
            <option value="app-server">app-server (app API)</option>
            <option value="lb">lb (load balancer :80)</option>
            <option value="mq">mq (RabbitMQ management HTTP :15672)</option>
            {cacheHttp ? (
              <option value="cache">cache (HTTP sidecar :8081)</option>
            ) : null}
          </select>

          <label className="mb-1 block text-gray-400">
            Path after proxy (optional)
          </label>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="e.g. shorten or abc123"
            className="mb-2 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 font-mono text-white"
          />

          <label className="mb-1 block text-gray-400">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
            className="mb-2 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-white"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          {method === 'POST' ? (
            <>
              <label className="mb-1 block text-gray-400">Body (JSON)</label>
              <textarea
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                rows={5}
                className="mb-2 w-full resize-y rounded border border-gray-600 bg-gray-800 px-2 py-1.5 font-mono text-white"
              />
            </>
          ) : null}

          <p className="mb-2 break-all font-mono text-[10px] text-gray-500">
            {urlPreview}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="w-full rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>

          {lastError ? (
            <p className="mt-2 rounded bg-red-950/80 px-2 py-1 text-red-200">
              {lastError}
            </p>
          ) : null}

          {lastStatus != null ? (
            <div className="mt-2 space-y-1 border-t border-gray-800 pt-2">
              <p className="text-gray-400">
                Status:{' '}
                <span className="font-mono text-white">{lastStatus}</span>
                {lastProxied != null ? (
                  <>
                    {' '}
                    ·{' '}
                    <span className="font-mono text-gray-300">
                      X-Cloud9-Proxied: {lastProxied || '—'}
                    </span>
                  </>
                ) : null}
              </p>
              {lastBody != null ? (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[11px] text-gray-300">
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
