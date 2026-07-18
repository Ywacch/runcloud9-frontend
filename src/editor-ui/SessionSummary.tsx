import {
  fmtErrorRate,
  fmtInt,
  fmtMs,
  fmtPct,
  fmtRate,
} from '../lib/format'
import type { SessionSparklines } from '../editor-core/domain/sessionHistoryFromApi'
import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import type { SessionSummary } from '../editor-core/stores/canvasStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { trackEvent } from '../lib/analytics'
import { HighlightReel } from './HighlightReel'
import { MetricChart } from './MetricChart'
import { ClientLatencyBoxChart } from './ClientLatencyBoxChart'

function markerRatios(
  markers: SessionSparklines['markers'],
  seriesLen: number
): Array<{ xRatio: number; type?: string }> {
  const n = Math.max(1, seriesLen - 1)
  return markers.map((m) => ({
    xRatio: seriesLen <= 1 ? 0 : m.index / n,
    type: m.type,
  }))
}

export interface SessionSummaryViewProps {
  summary: SessionSummary
  onDismiss: () => void
  title?: string
  statusLabel?: string
  actionLabel?: string
  modal?: boolean
}

export function SessionSummaryView({
  summary,
  onDismiss,
  title = 'Session Complete',
  statusLabel = 'Finished',
  actionLabel = 'Back to Design',
  modal = true,
}: SessionSummaryViewProps) {
  const inner = (
    <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)] p-5 shadow-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--c9-text)]">{title}</h2>
          <p className="text-xs text-[var(--c9-muted)]">
            {summary.template} · {summary.duration}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
          {statusLabel}
        </span>
      </div>

      {summary.eventsSummary?.length ? (
        <HighlightReel events={summary.eventsSummary} />
      ) : null}

      {summary.steadyState ? (
        <div className="mb-4 space-y-2 border-b border-[var(--c9-border)] pb-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
            Steady state (after 30s warmup)
          </h3>
          <p className="text-[10px] text-[var(--c9-muted)]">
            Prefer these for cache A/B comparisons — not session peaks.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard
              label="Steady p99"
              value={fmtMs(summary.steadyState.steadyP99Ms)}
            />
            <SummaryCard
              label="Steady RPS"
              value={fmtInt(summary.steadyState.steadyRps)}
            />
            <SummaryCard
              label="Steady DB query rate"
              value={fmtRate(summary.steadyState.steadyDbQueryRate)}
            />
            <SummaryCard
              label="Steady cache hit %"
              value={fmtPct(summary.steadyState.steadyCacheHitRate)}
            />
          </div>
        </div>
      ) : null}

      {summary.clientLatencyHistory && summary.clientLatencyHistory.length >= 4 ? (
        <div className="mb-4 space-y-2 border-b border-[var(--c9-border)] pb-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
            Client-path latency
          </h3>
          <p className="text-[10px] text-[var(--c9-muted)]">
            Client p99 · 5s windows across session (Vegeta → LB/app).
          </p>
          <ClientLatencyBoxChart intervals={summary.clientLatencyHistory} />
        </div>
      ) : null}

      {summary.sessionSparklines ? (
        <div className="mb-4 space-y-3 border-b border-[var(--c9-border)] pb-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
            Session replay (server)
          </h3>
          <p className="text-[10px] text-[var(--c9-muted)]">
            Downsampled from stored <code className="text-[var(--c9-text)]">session_history</code>
            . Ticks: cascade · threshold · other.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SparkRow
              label="Ingress RPS"
              unit="app-server"
              color="#6366f1"
              data={summary.sessionSparklines.rps}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="p99 latency"
              unit="ms"
              color="var(--c9-error)"
              data={summary.sessionSparklines.p99Ms}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Error rate"
              unit="/s"
              color="var(--c9-warning)"
              data={summary.sessionSparklines.errorRate}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Cache hit rate"
              unit="9m window · %"
              color="var(--c9-accent-hover)"
              data={summary.sessionSparklines.cacheHitPct}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="DB query rate"
              unit="queries/s"
              color="var(--c9-info)"
              data={summary.sessionSparklines.dbQueryRate}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Cache hits"
              unit="app-server /s"
              color="#22d3ee"
              data={summary.sessionSparklines.cacheHitsPerSec}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Cache misses"
              unit="app-server /s"
              color="var(--c9-warning)"
              data={summary.sessionSparklines.cacheMissesPerSec}
              markers={summary.sessionSparklines}
            />
          </div>
        </div>
      ) : null}

      {summary.storagePeaks ? (
        <div className="mb-4 space-y-2 border-b border-[var(--c9-border)] pb-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
            DB load peaks
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard
              label="Peak read rate"
              value={fmtRate(summary.storagePeaks.readRate)}
            />
            <SummaryCard
              label="Peak write rate"
              value={fmtRate(summary.storagePeaks.writeRate)}
            />
            <SummaryCard
              label="Peak read latency"
              value={fmtMs(summary.storagePeaks.readLatencyMs)}
            />
            <SummaryCard
              label="Peak write latency"
              value={fmtMs(summary.storagePeaks.writeLatencyMs)}
            />
            <SummaryCard
              label="Peak utilization"
              value={fmtPct(summary.storagePeaks.utilizationPct)}
            />
            <SummaryCard
              label="Peak store errors"
              value={fmtRate(summary.storagePeaks.errorRate)}
            />
          </div>
        </div>
      ) : null}

      <p className="mb-2 text-[10px] text-[var(--c9-muted)]">
        Legacy peaks below — max over the session; can mix cold start and throttle artifacts.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Peak RPS" value={fmtInt(summary.peakRps)} />
        <SummaryCard label="Peak p99" value={fmtMs(summary.peakP99)} />
        <SummaryCard
          label="Total Requests"
          value={fmtInt(summary.totalRequests)}
        />
        <SummaryCard
          label="Cache Hit Rate"
          value={fmtPct(summary.cacheHitRate)}
        />
        <SummaryCard
          label="Avg Latency"
          value={fmtMs(summary.avgLatency)}
        />
        <SummaryCard
          label="Error Rate"
          value={fmtErrorRate(summary.errorRate)}
        />
        {summary.eventsRecorded != null && summary.eventsRecorded > 0 ? (
          <SummaryCard
            label="Events (timeline)"
            value={fmtInt(summary.eventsRecorded)}
          />
        ) : null}
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--c9-muted)]">
          Components
        </h3>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {Object.entries(summary.componentSummaries).map(([nodeId, c]) => (
            <div
              key={nodeId}
              className="flex items-center justify-between rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 px-3 py-1.5 text-xs"
            >
              <span className="text-[var(--c9-text)]">{c.label}</span>
              <span className="font-mono text-[var(--c9-muted)]">
                CPU {c.cpuSummary} · Mem {c.memSummary}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-5 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
      >
        {actionLabel}
      </button>
    </div>
  )

  if (!modal) return inner

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/70 p-4 backdrop-blur-sm">
      {inner}
    </div>
  )
}

export function SessionSummary() {
  const summary = useCanvasStore((s) => s.sessionSummary)
  const restorePredicted = useStorytellingStore((s) => s.restorePersistedPredictions)
  const mountTimeRef = useRef<number | null>(null)

  const dismiss = () => {
    const visibleSeconds = mountTimeRef.current
      ? Math.floor((Date.now() - mountTimeRef.current) / 1000)
      : 0
    if (summary) {
      trackEvent('session_summary_dismissed', {
        template: summary.template ?? 'unknown',
        visibleSeconds,
      })
    }
    useCanvasStore.getState().setSessionSummary(null)
  }

  useEffect(() => {
    if (summary?.template) restorePredicted(summary.template)
  }, [summary?.template, restorePredicted])

  useEffect(() => {
    if (!summary) return
    mountTimeRef.current = Date.now()
    trackEvent('session_summary_viewed', {
      template: summary.template ?? 'unknown',
      sessionDuration: summary.duration ?? '',
    })
  }, [summary])

  if (!summary) return null

  return (
    <SessionSummaryView
      summary={summary}
      onDismiss={dismiss}
      modal={true}
    />
  )
}

function SparkRow({
  label,
  unit,
  color,
  data,
  markers,
}: {
  label: string
  unit?: string
  color: string
  data: number[]
  markers: SessionSparklines
}) {
  const eventMarkers = markerRatios(markers.markers, data.length)
  return (
    <MetricChart
      title={label}
      unit={unit}
      series={[{ data, color, showArea: true }]}
      compact
      eventMarkers={eventMarkers}
      pointCaption={(i, total) => `Sample ${i + 1} / ${total}`}
    />
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--c9-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-[var(--c9-text)]">{value}</div>
    </div>
  )
}
