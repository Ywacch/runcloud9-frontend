import {
  fmtErrorRate,
  fmtInt,
  fmtMs,
  fmtPct,
  fmtRate,
} from '../lib/format'
import type { SessionSparklines } from '../editor-core/domain/sessionHistoryFromApi'
import { useEffect } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { HighlightReel } from './HighlightReel'
import { SparkLine } from './SparkLine'

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

export function SessionSummary() {
  const summary = useCanvasStore((s) => s.sessionSummary)
  const restorePredicted = useStorytellingStore((s) => s.restorePersistedPredictions)
  const dismiss = () => useCanvasStore.getState().setSessionSummary(null)

  useEffect(() => {
    if (summary?.template) restorePredicted(summary.template)
  }, [summary?.template, restorePredicted])

  if (!summary) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)] p-5 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--c9-text)]">Session Complete</h2>
            <p className="text-xs text-[var(--c9-muted)]">
              {summary.template} · {summary.duration}
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
            Finished
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

        {summary.sessionSparklines ? (
          <div className="mb-4 space-y-3 border-b border-[var(--c9-border)] pb-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
              Session replay (server)
            </h3>
            <p className="text-[10px] text-[var(--c9-muted)]">
              Downsampled from stored <code className="text-[var(--c9-text)]">session_history</code>
              . Ticks: cascade · threshold · other.
            </p>
            <SparkRow
              label="Ingress RPS (app-server)"
              color="var(--c9-success)"
              data={summary.sessionSparklines.rps}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="p99 latency (ms)"
              color="var(--c9-error)"
              data={summary.sessionSparklines.p99Ms}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Error rate (/s)"
              color="var(--c9-warning)"
              data={summary.sessionSparklines.errorRate}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Cache hit % (9m window)"
              color="var(--c9-accent-hover)"
              data={summary.sessionSparklines.cacheHitPct}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="DB query rate"
              color="var(--c9-info)"
              data={summary.sessionSparklines.dbQueryRate}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Cache hits /s (app-server)"
              color="var(--c9-accent)"
              data={summary.sessionSparklines.cacheHitsPerSec}
              markers={summary.sessionSparklines}
            />
            <SparkRow
              label="Cache misses /s (app-server)"
              color="var(--c9-warning)"
              data={summary.sessionSparklines.cacheMissesPerSec}
              markers={summary.sessionSparklines}
            />
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
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
        >
          Back to Design
        </button>
      </div>
    </div>
  )
}

function SparkRow({
  label,
  color,
  data,
  markers,
}: {
  label: string
  color: string
  data: number[]
  markers: SessionSparklines
}) {
  const eventMarkers = markerRatios(markers.markers, data.length)
  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-[var(--c9-muted)]">
        {label}
      </div>
      <SparkLine
        data={data}
        color={color}
        width={320}
        height={40}
        showArea
        showDot
        eventMarkers={eventMarkers}
      />
    </div>
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
