import { useMemo, useState } from 'react'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { logComponentMatches } from '../lib/logComponent'
import { canvasToBackend } from '../lib/typeMapping'
import {
  logLineMatchesInstance,
  type SelectedInstanceId,
} from '../lib/dbInstanceScope'

const MAX_LOG_ROWS = 200

type LogFilter = 'all' | 'info' | 'warn' | 'err'

function normalizeLevel(level: string | undefined, message: string): LogFilter {
  const lvl = (level ?? '').toLowerCase()
  const msg = message.toLowerCase()
  if (lvl === 'error' || msg.includes('error') || msg.includes(' err')) return 'err'
  if (lvl === 'warn' || lvl === 'warning' || msg.includes('warn')) return 'warn'
  return 'info'
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

export function StacklabLogPanel({
  node,
  instanceId = null,
  replicaLayerIds,
  onOpenMetrics,
}: {
  node: CanvasNode
  instanceId?: SelectedInstanceId
  replicaLayerIds?: string[]
  onOpenMetrics?: () => void
}) {
  const logs = useLogStore((s) => s.logs)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const component = canvasToBackend[node.type]

  const componentLogs = useMemo(() => {
    if (!component) return []
    return logs
      .filter((l) => logComponentMatches(l.component, component))
      .filter((l) =>
        logLineMatchesInstance(l.pod, instanceId, { replicaLayerIds }),
      )
  }, [logs, component, instanceId, replicaLayerIds])

  const filtered = useMemo(() => {
    if (filter === 'all') return componentLogs
    return componentLogs.filter(
      (l) => normalizeLevel(l.level, l.message) === filter,
    )
  }, [componentLogs, filter])

  const shown = filtered.slice(-MAX_LOG_ROWS)

  return (
    <section className="sec">
      <div className="sec-head">
        <span className="sec-idx">L</span>
        <div>
          <h2>What did this hop say?</h2>
          <p className="sec-sub">Streaming from the pod set · level ≥ info.</p>
        </div>
      </div>

      <div className="logbar">
        <span className="logbar-count">
          <b>{filtered.length.toLocaleString()}</b> events
          {filtered.length > MAX_LOG_ROWS ? ` · showing latest ${MAX_LOG_ROWS}` : ''}
        </span>
        <span className="logbar-sp" />
        <div className="logbar-filter">
          {(['all', 'info', 'warn', 'err'] as LogFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'is-on' : ''}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="log-empty">NO EVENTS AT THIS LEVEL IN THE CURRENT WINDOW</div>
      ) : (
        <div className="log-list">
          {shown.map((line, i) => {
            const key = `${line.id ?? line.timestamp}-${i}`
            const open = openKey === key
            const level = normalizeLevel(line.level, line.message)
            const kv = fieldsEntries(line.fields)
            const hasDetail = kv.length > 0
            return (
              <div key={key} className={`log-row${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="log-head"
                  disabled={!hasDetail}
                  aria-expanded={hasDetail ? open : undefined}
                  onClick={() => {
                    if (!hasDetail) return
                    setOpenKey(open ? null : key)
                  }}
                >
                  <span className="log-ts">{ts(line.timestamp)}</span>
                  <span className={`log-lv ${level}`}>{level}</span>
                  <span className="log-msg">{line.message}</span>
                  <span className="log-car">{hasDetail ? (open ? '▾' : '▸') : ''}</span>
                </button>
                {hasDetail ? (
                  <div className="log-detail">
                    {kv.map(([k, v]) => (
                      <div key={k} className="log-kv">
                        <span className="k">{k}</span>
                        <span className="v">{v}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {onOpenMetrics ? (
        <button type="button" className="hint" onClick={onOpenMetrics}>
          <span className="hint-mark">←</span>
          <span className="hint-txt">
            Same window as <b>Metrics</b>
          </span>
          <span className="hint-rule" />
          <span className="hint-arrow">←</span>
        </button>
      ) : null}
    </section>
  )
}

/** Log count for tab badge (component-scoped). */
export function stacklabLogCountForNode(
  node: CanvasNode,
  logs: { component?: string }[],
): number {
  const component = canvasToBackend[node.type]
  if (!component) return 0
  return logs.filter((l) => logComponentMatches(l.component, component)).length
}
