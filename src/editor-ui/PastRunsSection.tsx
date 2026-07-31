import { useEffect, useState } from 'react'
import {
  listDeploymentHistory,
  getDeployment,
  type DeploymentHistoryItem,
} from '../lib/api'
import { sessionSummaryFromApiMetrics } from '../lib/sessionCapture'
import type { SessionSummary } from '../editor-core/stores/canvasStore'
import { SessionSummaryView } from './SessionSummary'
import { fmtInt, fmtMs } from '../lib/format'
import { C9Card } from './c9Primitives'

type DetailState =
  | { kind: 'summary'; summary: SessionSummary; title: string; statusLabel: string }
  | { kind: 'no-metrics'; title: string; statusLabel: string }

function fmtDuration(secs: number | undefined): string {
  if (secs == null || !Number.isFinite(secs)) return 'Unavailable'
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function fmtOptional(
  val: number | undefined,
  fmt: (n: number) => string,
): string {
  return val === undefined ? 'Unavailable' : fmt(val)
}

function capLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function PastRunsSection() {
  const [history, setHistory] = useState<DeploymentHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setHistoryLoading(true)
    setHistoryError(null)
    listDeploymentHistory(20)
      .then((items) => {
        setHistory(items)
        setHistoryLoading(false)
      })
      .catch((err: unknown) => {
        setHistoryError(
          err instanceof Error ? err.message : 'Failed to load history.',
        )
        setHistoryLoading(false)
      })
  }, [retryKey])

  const handleCardClick = async (item: DeploymentHistoryItem) => {
    if (detailLoading) return
    setDetailLoading(true)
    try {
      const dep = await getDeployment(item.namespace)
      const metrics = dep.metricsSummary as Record<string, unknown> | undefined
      const title = `Past run · ${item.template}`
      const statusLabel = capLabel(item.status)
      if (!metrics) {
        setDetail({ kind: 'no-metrics', title, statusLabel })
      } else {
        const summary = sessionSummaryFromApiMetrics(item.template, metrics)
        setDetail({ kind: 'summary', summary, title, statusLabel })
      }
    } catch {
      setDetail({
        kind: 'no-metrics',
        title: `Past run · ${item.template}`,
        statusLabel: capLabel(item.status),
      })
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <>
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
          Past runs
        </h2>

        {historyLoading ? (
          <div className="flex items-center gap-3 text-sm text-[var(--c9-muted)]">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--c9-accent)] border-t-transparent"
              aria-hidden
            />
            Loading…
          </div>
        ) : historyError ? (
          <C9Card className="p-5 text-center">
            <p className="text-sm text-[var(--c9-muted)]">{historyError}</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-3 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-1.5 text-xs text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
            >
              Retry
            </button>
          </C9Card>
        ) : history.length === 0 ? (
          <C9Card className="p-5 text-center">
            <p className="text-sm text-[var(--c9-muted)]">No completed runs yet.</p>
          </C9Card>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={detailLoading}
                onClick={() => void handleCardClick(item)}
                className="w-full rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 px-4 py-3 text-left shadow-xl shadow-black/20 transition-colors hover:border-[var(--c9-accent)]/60 hover:bg-[var(--c9-surface)] disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--c9-text)]">
                      {item.template}
                    </p>
                    <p className="text-xs text-[var(--c9-muted)]">
                      {item.archetype} ·{' '}
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      item.status === 'terminated'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {capLabel(item.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <RunStat
                    label="Duration"
                    value={fmtDuration(item.durationSeconds)}
                  />
                  <RunStat
                    label="Peak RPS"
                    value={fmtOptional(item.peakRps, fmtInt)}
                  />
                  <RunStat
                    label="Peak p99"
                    value={fmtOptional(item.peakP99Ms, fmtMs)}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {detail?.kind === 'summary' && (
        <SessionSummaryView
          summary={detail.summary}
          onDismiss={() => setDetail(null)}
          title={detail.title}
          statusLabel={detail.statusLabel}
          actionLabel="Close"
          modal={true}
        />
      )}

      {detail?.kind === 'no-metrics' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/70 p-4 backdrop-blur-sm">
          <C9Card className="w-full max-w-sm p-6 text-center">
            <h2 className="text-base font-semibold text-[var(--c9-text)]">
              {detail.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--c9-muted)]">
              Status: {detail.statusLabel}
            </p>
            <p className="mt-4 text-sm text-[var(--c9-muted)]">
              No metrics summary for this run.
            </p>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="mt-5 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
            >
              Close
            </button>
          </C9Card>
        </div>
      )}
    </>
  )
}

function RunStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-[var(--c9-muted)]">
      <span className="uppercase tracking-wider">{label}: </span>
      <span className="font-mono text-[var(--c9-text)]">{value}</span>
    </span>
  )
}
