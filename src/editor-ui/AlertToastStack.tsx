import { useEffect } from 'react'
import {
  ALERT_AUTO_DISMISS_MS,
  useInspectorAlertStore,
} from '../editor-core/stores/inspectorAlertStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import type { InspectorAlertSeverity } from '../lib/inspectorAlerts'

function severityBorder(severity: InspectorAlertSeverity): string {
  return severity === 'critical'
    ? 'border-red-500/40'
    : 'border-amber-500/40'
}

function severityTitle(severity: InspectorAlertSeverity): string {
  return severity === 'critical' ? 'text-red-300' : 'text-amber-300'
}

function severityBar(severity: InspectorAlertSeverity): string {
  return severity === 'critical' ? 'bg-red-400/80' : 'bg-amber-400/80'
}

/** Watches live metrics and syncs threshold alert candidates into the toast store. */
export function InspectorAlertWatcher() {
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const metrics = useMetricsStore((s) => s.metrics)
  const syncFromMetrics = useInspectorAlertStore((s) => s.syncFromMetrics)
  const clear = useInspectorAlertStore((s) => s.clear)

  useEffect(() => {
    if (mode !== 'live') {
      clear()
      return
    }
    syncFromMetrics(nodes, metrics)
  }, [mode, nodes, metrics, syncFromMetrics, clear])

  return null
}

/** Floating threshold alerts in the canvas column (not over the docked inspector). */
export function AlertToastStack() {
  const active = useInspectorAlertStore((s) => s.active)

  if (active.length === 0) return null

  return (
    <div
      className="pointer-events-auto absolute right-3 top-16 z-40 flex w-[min(100%,380px)] flex-col gap-2"
      aria-live="polite"
    >
      {active.map((toast) => (
        <AlertToastCard
          key={toast.id}
          id={toast.id}
          severity={toast.severity}
          title={toast.title}
          body={toast.body}
          shownAt={toast.shownAt}
        />
      ))}
    </div>
  )
}

function AlertToastCard({
  id,
  severity,
  title,
  body,
  shownAt,
}: {
  id: string
  severity: InspectorAlertSeverity
  title: string
  body: string
  shownAt: number
}) {
  useEffect(() => {
    const elapsed = Date.now() - shownAt
    const remaining = Math.max(0, ALERT_AUTO_DISMISS_MS - elapsed)
    const timer = window.setTimeout(() => {
      useInspectorAlertStore.getState().dismiss(id)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [id, shownAt])

  const elapsed = Math.min(
    ALERT_AUTO_DISMISS_MS,
    Math.max(0, Date.now() - shownAt),
  )

  return (
    <div
      className={`inspector-alert-enter relative overflow-hidden rounded-xl border bg-[var(--c9-bg-card)]/95 px-4 py-3 shadow-xl backdrop-blur-sm ${severityBorder(severity)}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${severityTitle(severity)}`}>
            {title}
          </p>
          <p className="mt-1 text-xs text-[var(--c9-muted)]">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => useInspectorAlertStore.getState().dismiss(id)}
          className="shrink-0 rounded p-1 text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
          aria-label="Dismiss alert"
        >
          <span aria-hidden className="text-sm font-medium">
            X
          </span>
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--c9-border)]/40">
        <div
          className={`inspector-alert-progress h-full origin-left ${severityBar(severity)}`}
          style={{
            animationDuration: `${ALERT_AUTO_DISMISS_MS}ms`,
            animationDelay: `-${elapsed}ms`,
          }}
        />
      </div>
    </div>
  )
}
