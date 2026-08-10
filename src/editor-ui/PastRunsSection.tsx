import { useEffect, useMemo, useState } from 'react'
import {
  listDeploymentHistory,
  listActiveDeployments,
  getDeployment,
  getTemplates,
  type TemplateInfo,
} from '../lib/api'
import { sessionSummaryFromApiMetrics } from '../lib/sessionCapture'
import type { SessionSummary } from '../editor-core/stores/canvasStore'
import { SessionSummaryView } from './SessionSummary'
import { fmtInt, fmtMs } from '../lib/format'
import { C9Card } from './c9Primitives'
import { MiniTopologyPreview } from '../components/dashboard/MiniTopologyPreview'
import { templatePresetToCanvasSnapshot } from '../lib/templatePresetAdapter'
import {
  filterPastRuns,
  mergeActiveAndHistory,
  type PastRunDateRange,
  type PastRunListItem,
  type PastRunStatusFilter,
} from '../lib/pastRunsFilters'

type DetailState =
  | { kind: 'summary'; summary: SessionSummary; title: string; statusLabel: string }
  | { kind: 'no-metrics'; title: string; statusLabel: string }

function fmtDuration(secs: number | undefined): string {
  if (secs == null || !Number.isFinite(secs)) return '-'
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function fmtOptional(
  val: number | undefined,
  fmt: (n: number) => string,
): string {
  return val === undefined ? '-' : fmt(val)
}

function capLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

const STATUS_OPTIONS: { value: PastRunStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'failed', label: 'Failed' },
]

const DATE_OPTIONS: { value: PastRunDateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const controlClass =
  'rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--c9-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)]'

export function PastRunsSection() {
  const [runs, setRuns] = useState<PastRunListItem[]>([])
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [statusFilter, setStatusFilter] = useState<PastRunStatusFilter>('all')
  const [dateRange, setDateRange] = useState<PastRunDateRange>('all')

  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setHistoryLoading(true)
    setHistoryError(null)
    void Promise.all([
      listActiveDeployments().catch(() => []),
      listDeploymentHistory(50),
      getTemplates().catch(() => [] as TemplateInfo[]),
    ])
      .then(([active, history, tpls]) => {
        setRuns(mergeActiveAndHistory({ active, history }))
        setTemplates(tpls)
        setHistoryLoading(false)
      })
      .catch((err: unknown) => {
        setHistoryError(
          err instanceof Error ? err.message : 'Failed to load history.',
        )
        setHistoryLoading(false)
      })
  }, [retryKey])

  const filtered = useMemo(
    () =>
      filterPastRuns(runs, {
        search: debouncedSearch,
        status: statusFilter,
        dateRange,
      }),
    [runs, debouncedSearch, statusFilter, dateRange],
  )

  const snapshotByTemplate = useMemo(() => {
    const map = new Map<
      string,
      {
        nodes: { id: string; type: string; position: [number, number, number] }[]
        edges: { sourceId: string; targetId: string }[]
      }
    >()
    for (const t of templates) {
      const preset = t.preset ?? t.presetLite
      if (!preset) continue
      try {
        const snap = templatePresetToCanvasSnapshot(preset, t.id)
        map.set(t.id, {
          nodes: snap.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
          })),
          edges: snap.edges.map((e) => ({
            sourceId: e.sourceId,
            targetId: e.targetId,
          })),
        })
      } catch {
        /* skip broken preset */
      }
    }
    return map
  }, [templates])

  const handleCardClick = async (item: PastRunListItem) => {
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

  const filtersActive =
    debouncedSearch.trim() !== '' ||
    statusFilter !== 'all' ||
    dateRange !== 'all'

  return (
    <>
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--c9-muted)]">
            Past runs
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[10rem] flex-1 sm:flex-none">
              <span className="sr-only">Search by template name</span>
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--c9-muted)]"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
                <path
                  d="M10.5 10.5 13.5 13.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by template name"
                className={`${controlClass} w-full pl-8 sm:w-52`}
              />
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as PastRunStatusFilter)
                }
                className={controlClass}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Date range</span>
              <select
                value={dateRange}
                onChange={(e) =>
                  setDateRange(e.target.value as PastRunDateRange)
                }
                className={controlClass}
              >
                {DATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {historyLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-card)]"
              />
            ))}
          </div>
        ) : historyError ? (
          <C9Card className="p-5 text-center">
            <p className="text-sm text-[var(--c9-muted)]">{historyError}</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-3 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] px-4 py-1.5 text-xs text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
            >
              Retry
            </button>
          </C9Card>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-card)] px-5 py-10 text-center">
            <p className="text-sm text-[var(--c9-muted)]">No runs yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-card)] px-5 py-10 text-center">
            <p className="text-sm text-[var(--c9-muted)]">
              {filtersActive
                ? 'No runs match your filters'
                : 'No runs yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const topo = snapshotByTemplate.get(item.template)
              const hasTopo = (topo?.nodes.length ?? 0) > 0
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={detailLoading}
                  title={item.template}
                  onClick={() => void handleCardClick(item)}
                  className="flex flex-col overflow-hidden rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-card)] text-left transition-colors hover:border-[var(--c9-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] disabled:opacity-60"
                >
                  {hasTopo ? (
                  <div className="aspect-[2.5/1] border-b border-[var(--c9-border)] bg-[var(--c9-bg)]/40 p-3">
                    <MiniTopologyPreview
                      nodes={topo?.nodes ?? []}
                      edges={topo?.edges ?? []}
                    />
                  </div>
                  ) : null}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--c9-text-heading)]">
                          {item.template}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--c9-text-muted)]">
                          {item.archetype} ·{' '}
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2">
                      <div>
                        <dt className="text-[10px] text-[var(--c9-text-muted)]">
                          Duration
                        </dt>
                        <dd className="font-mono text-[0.72rem] tabular-nums text-[var(--c9-text)]">
                          {fmtDuration(item.durationSeconds)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-[var(--c9-text-muted)]">
                          Peak RPS
                        </dt>
                        <dd className="font-mono text-[0.72rem] tabular-nums text-[var(--c9-text)]">
                          {fmtOptional(item.peakRps, fmtInt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-[var(--c9-text-muted)]">
                          Peak P99
                        </dt>
                        <dd className="font-mono text-[0.72rem] tabular-nums text-[var(--c9-text)]">
                          {fmtOptional(item.peakP99Ms, fmtMs)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </button>
              )
            })}
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

function StatusBadge({ status }: { status: PastRunListItem['status'] }) {
  const styles =
    status === 'running'
      ? 'bg-sky-500/15 text-sky-300'
      : status === 'terminated'
        ? 'bg-emerald-500/15 text-emerald-300'
        : 'bg-red-500/15 text-red-300'

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles}`}
    >
      {capLabel(status)}
    </span>
  )
}
