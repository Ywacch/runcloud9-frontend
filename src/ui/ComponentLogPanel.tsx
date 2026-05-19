import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CanvasNode } from '../store/canvasStore'
import { useLogStore } from '../store/logStore'
import { canvasToBackend } from '../lib/typeMapping'

const MAX_COMPONENT_LOGS = 500
/** If the user is within this many px of the bottom, new lines keep the tail pinned. */
const PIN_THRESHOLD_PX = 72

function levelColor(level: string | undefined, message: string): string {
  const lvl = (level ?? '').toLowerCase()
  const msg = message.toLowerCase()
  if (lvl === 'error' || msg.includes('error') || msg.includes(' err')) return 'text-red-400'
  if (lvl === 'warn' || lvl === 'warning' || msg.includes('warn')) return 'text-amber-400'
  if (lvl === 'debug') return 'text-slate-400'
  return 'text-[var(--c9-text)]'
}

function ts(t: string): string {
  const d = new Date(t)
  return Number.isNaN(d.getTime())
    ? t
    : d.toLocaleTimeString('en-US', { hour12: false })
}

function fieldsEntries(fields: Record<string, unknown> | undefined): [string, string][] {
  if (!fields) return []
  return Object.entries(fields).map(([k, v]) => [
    k,
    typeof v === 'string' ? v : JSON.stringify(v),
  ])
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-500/30 px-0.5 text-inherit">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function matchesSearch(message: string, fields: Record<string, unknown> | undefined, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  if (message.toLowerCase().includes(lower)) return true
  if (fields && JSON.stringify(fields).toLowerCase().includes(lower)) return true
  return false
}

export function ComponentLogPanel({ node }: { node: CanvasNode }) {
  const logs = useLogStore((s) => s.logs)
  const activeTraceId = useLogStore((s) => s.activeTraceId)
  const setActiveTraceId = useLogStore((s) => s.setActiveTraceId)
  const [followTail, setFollowTail] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [pinnedLineId, setPinnedLineId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const distanceFromBottomRef = useRef(0)
  const component = canvasToBackend[node.type]

  const filtered = useMemo(
    () =>
      logs
        .filter((l) => l.component === component)
        .filter((l) => matchesSearch(l.message, l.fields, searchQuery))
        .slice(-MAX_COMPONENT_LOGS),
    [logs, component, searchQuery],
  )

  const syncDistanceFromBottom = () => {
    const el = listRef.current
    if (!el) return
    distanceFromBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight
  }

  /** New log lines do not emit `scroll`; measure pin using the last scroll position. */
  useLayoutEffect(() => {
    if (!followTail) return
    const el = listRef.current
    if (!el) return
    if (distanceFromBottomRef.current <= PIN_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight
    }
    syncDistanceFromBottom()
  }, [filtered, followTail])

  const onScroll = () => {
    syncDistanceFromBottom()
    const d = distanceFromBottomRef.current
    if (d <= PIN_THRESHOLD_PX) {
      if (!followTail && !pinnedLineId) setFollowTail(true)
    } else if (followTail) {
      setFollowTail(false)
    }
  }

  const clearPin = () => {
    setPinnedLineId(null)
    setFollowTail(true)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
          Logs · {node.label}
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter logs…"
          className="h-6 min-w-0 flex-1 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 text-[10px] text-[var(--c9-text)] placeholder:text-[var(--c9-muted)] focus:border-[var(--c9-accent)] focus:outline-none"
        />
        <label className="flex items-center gap-1 text-[10px] text-[var(--c9-muted)]">
          <input
            type="checkbox"
            checked={followTail}
            onChange={(e) => {
              const on = e.target.checked
              setFollowTail(on)
              if (on) {
                setPinnedLineId(null)
                queueMicrotask(() => {
                  const el = listRef.current
                  if (!el) return
                  el.scrollTop = el.scrollHeight
                  syncDistanceFromBottom()
                })
              }
            }}
          />
          Follow new logs
        </label>
      </div>
      {(searchQuery || pinnedLineId || activeTraceId) ? (
        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          {searchQuery ? (
            <span className="text-[var(--c9-muted)]">
              {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
            </span>
          ) : null}
          {pinnedLineId ? (
            <button
              type="button"
              onClick={clearPin}
              className="text-[var(--c9-accent)] hover:underline"
            >
              ✕ Unpin
            </button>
          ) : null}
          {activeTraceId ? (
            <button
              type="button"
              onClick={() => setActiveTraceId(null)}
              className="flex items-center gap-1 text-cyan-400 hover:underline"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Tracing {activeTraceId.slice(0, 8)}…
              <span className="text-[var(--c9-muted)]">✕</span>
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="max-h-72 overflow-y-auto rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 p-2 font-mono text-[11px]"
      >
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-[var(--c9-muted)]">
            {searchQuery
              ? `No ${component} logs match "${searchQuery}"`
              : `Waiting for ${component} logs…`}
          </p>
        ) : (
          filtered.map((line, i) => {
            const id = `${line.timestamp}-${i}-${line.component}`
            const hasFields = Boolean(line.fields && Object.keys(line.fields).length)
            const isPinned = pinnedLineId === id
            const isTraced =
              activeTraceId != null && line.fields?.request_id === activeTraceId
            const decorationClass = isPinned
              ? 'border-l-2 border-l-[var(--c9-accent)] bg-[var(--c9-accent)]/5 pl-2'
              : isTraced
                ? 'border-l-2 border-l-cyan-400 bg-cyan-400/5 pl-2'
                : ''
            return (
              <div
                key={id}
                className={`border-b border-[var(--c9-border)]/50 py-1.5 transition-colors last:border-0 ${decorationClass}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (pinnedLineId === id) {
                      clearPin()
                      return
                    }
                    setPinnedLineId(id)
                    setFollowTail(false)
                    if (hasFields) {
                      setExpanded((s) => ({ ...s, [id]: !s[id] }))
                    }
                  }}
                  className="flex w-full cursor-pointer items-start gap-2 text-left"
                >
                  <span className="shrink-0 text-[10px] text-[var(--c9-muted)]">{ts(line.timestamp)}</span>
                  <span className={`min-w-0 flex-1 break-words ${levelColor(line.level, line.message)}`}>
                    {highlightMatch(line.message, searchQuery)}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase text-[var(--c9-muted)]">
                    {line.level ?? 'info'}
                  </span>
                </button>
                {hasFields && expanded[id] ? (
                  <div className="mt-1 rounded border border-[var(--c9-border)]/60 bg-[var(--c9-surface)]/70 px-2 py-1 text-[10px]">
                    {fieldsEntries(line.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="shrink-0 text-[var(--c9-muted)]">{k}</span>
                        <span className="break-all text-[var(--c9-text)]">{v}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
