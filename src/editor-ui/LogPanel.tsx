import { useLayoutEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { useProvisionFloorStore } from '../editor-core/stores/provisionFloorStore'

const COMPONENT_COLORS: Record<string, string> = {
  'app-server': 'var(--c9-text-muted)',
  db: 'var(--c9-text-disabled)',
  cache: 'var(--c9-error)',
  lb: 'var(--c9-info)',
  mq: 'var(--c9-accent)',
  worker: 'var(--c9-accent-hover)',
}

function logLevelClass(level: string | undefined, msg: string): string {
  const lvl = (level ?? '').toLowerCase()
  const lower = msg.toLowerCase()
  if (lvl === 'error' || lower.includes('error') || lower.includes('err')) return 'text-red-400'
  if (lvl === 'warn' || lvl === 'warning' || lower.includes('warn')) return 'text-amber-400'
  if (lvl === 'debug') return 'text-slate-400'
  return 'text-gray-300'
}

const PIN_THRESHOLD_PX = 72

export function LogPanel() {
  const mode = useCanvasStore((s) => s.mode)
  const provisionActive = useProvisionFloorStore((s) => s.active)
  const provisionPreview = useProvisionFloorStore((s) => s.preview)
  const logs = useLogStore((s) => s.logs)
  const activeTraceId = useLogStore((s) => s.activeTraceId)
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const distanceFromBottomRef = useRef(0)
  const prevOpenRef = useRef(false)

  const syncDistanceFromBottom = () => {
    const el = listRef.current
    if (!el) return
    distanceFromBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight
  }

  useLayoutEffect(() => {
    if (open && !prevOpenRef.current) {
      distanceFromBottomRef.current = 0
    }
    prevOpenRef.current = open
    if (!open) return
    const el = listRef.current
    if (!el) return
    if (distanceFromBottomRef.current <= PIN_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight
    }
    syncDistanceFromBottom()
  }, [logs, open])

  const onScroll = () => {
    syncDistanceFromBottom()
  }

  if (mode !== 'live' && !provisionActive) return null

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full border-t border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-4 py-2 text-left text-xs font-medium text-[var(--c9-muted)] backdrop-blur-sm transition-colors duration-200 hover:text-[var(--c9-text)]"
      >
        {open ? '▼ Hide Logs' : '▲ Show Logs'} ({logs.length}
        {provisionActive && !provisionPreview && logs.length === 0
          ? ' · waiting for pod output'
          : ''}
        )
      </button>
      {open ? (
        <div
          ref={listRef}
          onScroll={onScroll}
          className="max-h-48 overflow-y-auto border-t border-[var(--c9-border)] bg-[var(--c9-bg)]/95 px-4 py-2 font-mono text-xs backdrop-blur-sm"
        >
          {logs.length === 0 ? (
            <div className="py-2 text-[var(--c9-muted)]">
              {provisionPreview
                ? 'No logs in DEV preview. Live deploys stream pod output here when it exists.'
                : 'No logs yet.'}
            </div>
          ) : null}
          {logs.slice(-200).map((l) => {
            const isTraced =
              activeTraceId != null && l.fields?.request_id === activeTraceId
            return (
              <div
                key={l.id}
                className={`flex gap-2 border-b border-[var(--c9-border)] py-1 ${
                  isTraced ? 'border-l-2 border-l-cyan-400 bg-cyan-400/5 pl-1' : ''
                }`}
              >
                <span className="shrink-0 text-[var(--c9-muted)]">
                  {new Date(l.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                  })}
                </span>
                <span
                  className="shrink-0 rounded px-1 text-[10px]"
                  style={{
                    color: COMPONENT_COLORS[l.component] ?? 'var(--c9-text-disabled)',
                  }}
                >
                  {l.component}
                </span>
                <span className={logLevelClass(l.level, l.message)}>{l.message}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
