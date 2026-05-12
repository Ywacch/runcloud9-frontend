import { useLayoutEffect, useMemo, useRef, useState } from 'react'
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

export function ComponentLogPanel({ node }: { node: CanvasNode }) {
  const logs = useLogStore((s) => s.logs)
  const [followTail, setFollowTail] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const listRef = useRef<HTMLDivElement | null>(null)
  const distanceFromBottomRef = useRef(0)
  const component = canvasToBackend[node.type]

  const filtered = useMemo(
    () =>
      logs
        .filter((l) => l.component === component)
        .slice(-MAX_COMPONENT_LOGS),
    [logs, component],
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
      if (!followTail) setFollowTail(true)
    } else if (followTail) {
      setFollowTail(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
          Logs · {node.label}
        </h3>
        <label className="flex items-center gap-1 text-[10px] text-[var(--c9-muted)]">
          <input
            type="checkbox"
            checked={followTail}
            onChange={(e) => {
              const on = e.target.checked
              setFollowTail(on)
              if (on) {
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
      <div
        ref={listRef}
        onScroll={onScroll}
        className="max-h-72 overflow-y-auto rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 p-2 font-mono text-[11px]"
      >
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-[var(--c9-muted)]">Waiting for {component} logs…</p>
        ) : (
          filtered.map((line, i) => {
            const id = `${line.timestamp}-${i}-${line.component}`
            const hasFields = Boolean(line.fields && Object.keys(line.fields).length)
            return (
              <div key={id} className="border-b border-[var(--c9-border)]/50 py-1.5 last:border-0">
                <button
                  type="button"
                  onClick={() =>
                    hasFields &&
                    setExpanded((s) => ({
                      ...s,
                      [id]: !s[id],
                    }))
                  }
                  className={`flex w-full items-start gap-2 text-left ${hasFields ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="shrink-0 text-[10px] text-[var(--c9-muted)]">{ts(line.timestamp)}</span>
                  <span className={`min-w-0 flex-1 break-words ${levelColor(line.level, line.message)}`}>
                    {line.message}
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
