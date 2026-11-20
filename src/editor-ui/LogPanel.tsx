import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { useProvisionFloorStore } from '../editor-core/stores/provisionFloorStore'
import { logComponentMatches } from '../lib/logComponent'
import {
  formatLogElapsedClock,
  logElapsedSeconds,
  logLevelKind,
  logOriginMs,
  logSourceLabel,
} from '../lib/logPanelView'

const PIN_THRESHOLD_PX = 72

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LogPanel() {
  const mode = useCanvasStore((s) => s.mode)
  const provisionActive = useProvisionFloorStore((s) => s.active)
  const provisionPreview = useProvisionFloorStore((s) => s.preview)
  const logs = useLogStore((s) => s.logs)
  const activeTraceId = useLogStore((s) => s.activeTraceId)
  const [open, setOpen] = useState(false)
  const [filterSrc, setFilterSrc] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const distanceFromBottomRef = useRef(0)
  const prevOpenRef = useRef(false)
  const openedOnFirstLog = useRef(false)

  const visible = useMemo(() => {
    const slice = logs.slice(-200)
    if (!filterSrc) return slice
    return slice.filter((l) => logComponentMatches(l.component, filterSrc))
  }, [logs, filterSrc])

  const originMs = useMemo(
    () => logOriginMs(logs.map((l) => l.timestamp)),
    [logs],
  )

  const last = visible[visible.length - 1]
  const lastPreview = last
    ? `${logSourceLabel(last.component)}: ${last.message}`
    : provisionPreview
      ? 'No logs in DEV preview'
      : ''

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
  }, [visible, open])

  useEffect(() => {
    if (openedOnFirstLog.current) return
    if (!provisionActive || logs.length === 0) return
    openedOnFirstLog.current = true
    setOpen(true)
  }, [provisionActive, logs.length])

  useEffect(() => {
    if (!provisionActive) openedOnFirstLog.current = false
  }, [provisionActive])

  if (mode !== 'live' && !provisionActive) return null

  return (
    <section
      className="cv-logs"
      data-open={open ? 'true' : 'false'}
      aria-label="Deploy logs"
    >
      <button
        type="button"
        className="cv-logs-tab"
        aria-expanded={open}
        aria-controls="cv-logs-body"
        onClick={() => setOpen((v) => !v)}
      >
        <b>Logs</b>
        {filterSrc ? (
          <span className="cv-logs-flt">{logSourceLabel(filterSrc)}</span>
        ) : null}
        <span className="cv-logs-last">{lastPreview}</span>
        <Chevron className="cv-logs-chevron" />
      </button>
      {filterSrc ? (
        <button
          type="button"
          className="cv-logs-all"
          onClick={() => setFilterSrc(null)}
        >
          Show all
        </button>
      ) : null}
      <div
        id="cv-logs-body"
        ref={listRef}
        className="cv-logs-b"
        role="log"
        aria-live="off"
        tabIndex={0}
        onScroll={syncDistanceFromBottom}
      >
        {visible.length === 0 ? (
          <div className="cv-logs-empty">
            {provisionPreview
              ? 'No logs in DEV preview. Live deploys stream pod output here when it exists.'
              : 'No logs yet.'}
          </div>
        ) : (
          visible.map((l) => {
            const src = logSourceLabel(l.component)
            const kind = logLevelKind(l.level, l.message)
            const isTraced =
              activeTraceId != null && l.fields?.request_id === activeTraceId
            return (
              <div
                key={l.id}
                className={`cv-log${isTraced ? ' is-traced' : ''}`}
              >
                <span className="cv-log-t">
                  {formatLogElapsedClock(logElapsedSeconds(l.timestamp, originMs))}
                </span>
                <button
                  type="button"
                  className="cv-log-s"
                  title={`Show only ${src}`}
                  onClick={() => setFilterSrc(l.component)}
                >
                  {src}
                </button>
                <span
                  className={`cv-log-m${kind === 'err' ? ' is-err' : kind === 'warn' ? ' is-warn' : ''}`}
                >
                  {l.message}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
