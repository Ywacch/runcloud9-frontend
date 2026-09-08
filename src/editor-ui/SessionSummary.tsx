import {
  fmtErrorRate,
  fmtInt,
  fmtMs,
  fmtPct,
  fmtRate,
} from '../lib/format'
import type { SessionSparklines } from '../editor-core/domain/sessionHistoryFromApi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import type { SessionSummary } from '../editor-core/stores/canvasStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { trackEvent } from '../lib/analytics'
import { dispatchRequestDeploy } from '../lib/deployEvents'
import type { SessionEventSummary } from '../lib/eventsSummaryFromApi'
import { HighlightPanel } from './HighlightReel'
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

const SPARK_SERIES = [
  { key: 'rps', label: 'Ingress RPS', unit: 'app-server', color: '#6366f1' },
  { key: 'p99Ms', label: 'p99 latency', unit: 'ms', color: 'var(--c9-error)' },
  { key: 'errorRate', label: 'Error rate', unit: '/s', color: 'var(--c9-warning)' },
  {
    key: 'cacheHitPct',
    label: 'Cache hit rate',
    unit: '9m window · %',
    color: 'var(--c9-accent-hover)',
  },
  { key: 'dbQueryRate', label: 'DB query rate', unit: 'queries/s', color: 'var(--c9-info)' },
  { key: 'cacheHitsPerSec', label: 'Cache hits', unit: 'app-server /s', color: '#22d3ee' },
  {
    key: 'cacheMissesPerSec',
    label: 'Cache misses',
    unit: 'app-server /s',
    color: 'var(--c9-warning)',
  },
] as const

type SparkKey = (typeof SPARK_SERIES)[number]['key']
type SlideGroup = 'highlights' | 'outcome' | 'replay' | 'topology'

type SummarySlide = {
  id: string
  group: SlideGroup
  groupLabel: string
  event?: SessionEventSummary
}

function eventTokens(event: SessionEventSummary): string {
  return [event.component, event.rule, event.narrative, ...(event.related ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function relatedSparkKeys(event: SessionEventSummary): SparkKey[] {
  const t = eventTokens(event)
  if (/(cache)/.test(t)) {
    return ['cacheHitPct', 'cacheHitsPerSec', 'cacheMissesPerSec', 'dbQueryRate']
  }
  if (/(mq|queue|worker|fan-?out|prefetch)/.test(t)) {
    return ['rps', 'p99Ms', 'errorRate']
  }
  if (/(db|postgres|storage|query)/.test(t)) {
    return ['dbQueryRate', 'rps', 'p99Ms']
  }
  if (/(latency|p99|timeout)/.test(t)) {
    return ['p99Ms', 'rps', 'errorRate']
  }
  return ['rps', 'p99Ms']
}

function eventWantsClientLatency(event: SessionEventSummary): boolean {
  return /(latency|p99|timeout|rps|throttle)/.test(eventTokens(event))
}

function eventWantsStoragePeaks(event: SessionEventSummary): boolean {
  return /(db|postgres|storage|query|cache)/.test(eventTokens(event))
}

function buildSlides(summary: SessionSummary): SummarySlide[] {
  const slides: SummarySlide[] = []
  const events = summary.eventsSummary ?? []
  events.forEach((event, i) => {
    slides.push({
      id: `event-${i}-${event.rule}`,
      group: 'highlights',
      groupLabel: 'Highlights',
      event,
    })
  })
  if (summary.steadyState || (summary.clientLatencyHistory?.length ?? 0) >= 4) {
    slides.push({ id: 'outcome', group: 'outcome', groupLabel: 'Steady state' })
  }
  if (summary.sessionSparklines) {
    slides.push({ id: 'replay', group: 'replay', groupLabel: 'Session replay' })
  }
  slides.push({ id: 'topology', group: 'topology', groupLabel: 'Load & nodes' })
  return slides
}

export interface SessionSummaryViewProps {
  summary: SessionSummary
  onDismiss: () => void
  onRedeploy?: () => void
  onOpenCanvas?: () => void
  title?: string
  statusLabel?: string
  actionLabel?: string
  modal?: boolean
}

export function SessionSummaryView({
  summary,
  onDismiss,
  onRedeploy,
  onOpenCanvas,
  title = 'Session Complete',
  statusLabel = 'Finished',
  actionLabel = 'Back to Design',
  modal = true,
}: SessionSummaryViewProps) {
  const slides = useMemo(() => buildSlides(summary), [summary])
  const [index, setIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const slide = slides[Math.min(index, slides.length - 1)] ?? slides[0]
  const groups = useMemo(() => {
    const seen = new Set<SlideGroup>()
    return slides.filter((s) => {
      if (seen.has(s.group)) return false
      seen.add(s.group)
      return true
    })
  }, [slides])

  const sessionKey = `${summary.template}:${summary.duration}:${summary.eventsSummary?.length ?? 0}`
  useEffect(() => {
    setIndex(0)
  }, [sessionKey])

  useEffect(() => {
    if (modal) panelRef.current?.focus()
  }, [modal, sessionKey])

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(slides.length - 1, next)))
    },
    [slides.length],
  )

  const goToGroup = useCallback(
    (group: SlideGroup) => {
      const i = slides.findIndex((s) => s.group === group)
      if (i >= 0) setIndex(i)
    },
    [slides],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => Math.min(slides.length - 1, i + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Escape' && modal) {
        e.preventDefault()
        onDismiss()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setIndex(Math.max(0, slides.length - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, onDismiss, slides.length])

  const eventSlides = slides.filter((s) => s.group === 'highlights')
  const eventOrdinal =
    slide.group === 'highlights'
      ? eventSlides.findIndex((s) => s.id === slide.id) + 1
      : 0

  const inner = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role={modal ? 'dialog' : undefined}
      aria-modal={modal || undefined}
      aria-labelledby="session-summary-title"
      className="flex h-[min(38rem,calc(100dvh-2rem))] w-full max-w-[72rem] flex-col overflow-hidden rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)] shadow-2xl outline-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--c9-border)] px-5 py-4 md:px-6">
        <div className="min-w-0">
          <h2
            id="session-summary-title"
            className="truncate text-lg font-semibold tracking-tight text-[var(--c9-text-heading)]"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--c9-muted)]">
            {summary.template} · {summary.duration}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
          {statusLabel}
        </span>
      </header>

      <nav
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--c9-border)] px-3 py-2 md:px-5"
        aria-label="Summary sections"
      >
        {groups.map((g) => {
          const active = slide.group === g.group
          const count = slides.filter((s) => s.group === g.group).length
          return (
            <button
              key={g.group}
              type="button"
              onClick={() => goToGroup(g.group)}
              aria-current={active ? 'true' : undefined}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] ${
                active
                  ? 'bg-[var(--c9-bg-subtle)] text-[var(--c9-text-heading)]'
                  : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
              }`}
            >
              {g.groupLabel}
              {g.group === 'highlights' && count > 1 ? (
                <span className="ml-1.5 font-mono text-[11px] text-[var(--c9-muted)]">
                  {active ? `${eventOrdinal}/${count}` : count}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,0.42fr)_minmax(0,1fr)] lg:grid-cols-[minmax(17rem,22.5rem)_minmax(0,1fr)] lg:grid-rows-none">
        <aside className="min-h-0 overflow-y-auto border-[var(--c9-border)] px-5 py-5 md:px-6 lg:border-r">
          <SlideCopy
            summary={summary}
            slide={slide}
            eventOrdinal={eventOrdinal}
            eventCount={eventSlides.length}
            onSelectEvent={(i) => {
              const target = eventSlides[i]
              if (target) setIndex(slides.findIndex((s) => s.id === target.id))
            }}
          />
        </aside>
        <section
          className="min-h-0 overflow-y-auto px-5 py-5 md:px-6"
          aria-live="polite"
        >
          <SlideVisuals summary={summary} slide={slide} />
        </section>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--c9-border)] px-5 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(index - 1)}
            disabled={index <= 0}
            className="rounded-md border border-[var(--c9-border)] px-3 py-1.5 text-sm text-[var(--c9-text)] transition-colors hover:border-[var(--c9-border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(index + 1)}
            disabled={index >= slides.length - 1}
            className="rounded-md border border-[var(--c9-border)] px-3 py-1.5 text-sm text-[var(--c9-text)] transition-colors hover:border-[var(--c9-border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <p className="hidden font-mono text-[11px] tabular-nums text-[var(--c9-muted)] sm:block">
            {index + 1} / {slides.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCanvas ? (
            <button
              type="button"
              onClick={onOpenCanvas}
              className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] px-3 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors duration-200 hover:border-[var(--c9-border-strong)]"
            >
              Open in canvas
            </button>
          ) : null}
          {onRedeploy ? (
            <button
              type="button"
              onClick={onRedeploy}
              className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] px-3 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors duration-200 hover:border-[var(--c9-border-strong)]"
            >
              Redeploy
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            {actionLabel}
          </button>
        </div>
      </footer>
    </div>
  )

  if (!modal) return inner

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/70 p-4 backdrop-blur-sm">
      {inner}
    </div>
  )
}

function SlideCopy({
  summary,
  slide,
  eventOrdinal,
  eventCount,
  onSelectEvent,
}: {
  summary: SessionSummary
  slide: SummarySlide
  eventOrdinal: number
  eventCount: number
  onSelectEvent: (i: number) => void
}) {
  if (slide.group === 'highlights' && slide.event) {
    return (
      <div>
        <p className="text-sm text-[var(--c9-text)]">
          {eventCount === 1
            ? '1 notable event during your session'
            : `${eventCount} notable events during your session`}
        </p>
        {eventCount > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(summary.eventsSummary ?? []).map((ev, i) => {
              const active = i === eventOrdinal - 1
              return (
                <button
                  key={`${ev.timestamp}-${ev.rule}-${i}`}
                  type="button"
                  onClick={() => onSelectEvent(i)}
                  className={`max-w-[11rem] truncate rounded-md px-2 py-1 text-left font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] ${
                    active
                      ? 'bg-[var(--c9-bg-subtle)] text-[var(--c9-text-heading)]'
                      : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
                  }`}
                >
                  {ev.rule.replaceAll('_', ' ')}
                </button>
              )
            })}
          </div>
        ) : null}
        <div className="mt-5">
          <HighlightPanel event={slide.event} />
        </div>
      </div>
    )
  }

  if (slide.group === 'outcome') {
    return (
      <div>
        <h3 className="text-base font-semibold text-[var(--c9-text-heading)]">Steady state</h3>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--c9-muted)]">
          After 30s warmup. Prefer these for cache A/B comparisons, not session peaks.
        </p>
        {summary.steadyState ? (
          <dl className="mt-5 divide-y divide-[var(--c9-border)]">
            <MetricRow label="Steady p99" value={fmtMs(summary.steadyState.steadyP99Ms)} />
            <MetricRow label="Steady RPS" value={fmtInt(summary.steadyState.steadyRps)} />
            <MetricRow
              label="Steady DB query rate"
              value={fmtRate(summary.steadyState.steadyDbQueryRate)}
            />
            <MetricRow
              label="Steady cache hit %"
              value={fmtPct(summary.steadyState.steadyCacheHitRate)}
            />
          </dl>
        ) : (
          <p className="mt-5 text-sm text-[var(--c9-muted)]">
            No post-warmup medians for this run. Client-path latency is on the right.
          </p>
        )}
      </div>
    )
  }

  if (slide.group === 'replay') {
    return (
      <div>
        <h3 className="text-base font-semibold text-[var(--c9-text-heading)]">Session replay</h3>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--c9-muted)]">
          Server samples downsampled from stored session history. Ticks mark cascade,
          threshold, and other events.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--c9-text-heading)]">Load and nodes</h3>
      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--c9-muted)]">
        Session peaks can mix cold start and throttle artifacts. Use steady state for
        comparisons.
      </p>
      <dl className="mt-5 divide-y divide-[var(--c9-border)]">
        <MetricRow label="Peak RPS" value={fmtInt(summary.peakRps)} />
        <MetricRow label="Peak p99" value={fmtMs(summary.peakP99)} />
        <MetricRow label="Total requests" value={fmtInt(summary.totalRequests)} />
        <MetricRow label="Cache hit rate" value={fmtPct(summary.cacheHitRate)} />
        <MetricRow label="Avg latency" value={fmtMs(summary.avgLatency)} />
        <MetricRow label="Error rate" value={fmtErrorRate(summary.errorRate)} />
        {summary.eventsRecorded != null && summary.eventsRecorded > 0 ? (
          <MetricRow label="Events (timeline)" value={fmtInt(summary.eventsRecorded)} />
        ) : null}
      </dl>
    </div>
  )
}

function SlideVisuals({
  summary,
  slide,
}: {
  summary: SessionSummary
  slide: SummarySlide
}) {
  if (slide.group === 'highlights' && slide.event) {
    const keys = relatedSparkKeys(slide.event)
    const sparks = summary.sessionSparklines
    const showClient =
      eventWantsClientLatency(slide.event) &&
      (summary.clientLatencyHistory?.length ?? 0) >= 4
    const showStorage = eventWantsStoragePeaks(slide.event) && summary.storagePeaks
    const hasCharts = Boolean(sparks) || showClient || showStorage

    if (!hasCharts) {
      return (
        <p className="text-sm text-[var(--c9-muted)]">
          No matching time series for this event. Open Session replay for the full run.
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {sparks ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {keys.map((key) => {
              const spec = SPARK_SERIES.find((s) => s.key === key)
              if (!spec) return null
              return (
                <SparkRow
                  key={key}
                  label={spec.label}
                  unit={spec.unit}
                  color={spec.color}
                  data={sparks[key]}
                  markers={sparks}
                />
              )
            })}
          </div>
        ) : null}
        {showClient && summary.clientLatencyHistory ? (
          <ClientLatencyBoxChart intervals={summary.clientLatencyHistory} />
        ) : null}
        {showStorage && summary.storagePeaks ? (
          <StoragePeakGrid peaks={summary.storagePeaks} compact />
        ) : null}
      </div>
    )
  }

  if (slide.group === 'outcome') {
    if ((summary.clientLatencyHistory?.length ?? 0) < 4) {
      return (
        <p className="text-sm text-[var(--c9-muted)]">
          Client-path latency needs at least four 5s windows. Steady numbers are on the
          left.
        </p>
      )
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--c9-muted)]">
          Client p99 · 5s windows across the session (Vegeta → LB/app).
        </p>
        <ClientLatencyBoxChart intervals={summary.clientLatencyHistory!} />
      </div>
    )
  }

  if (slide.group === 'replay' && summary.sessionSparklines) {
    return (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {SPARK_SERIES.map((spec) => (
          <SparkRow
            key={spec.key}
            label={spec.label}
            unit={spec.unit}
            color={spec.color}
            data={summary.sessionSparklines![spec.key]}
            markers={summary.sessionSparklines!}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {summary.storagePeaks ? (
        <div>
          <h4 className="text-sm font-medium text-[var(--c9-text)]">DB load peaks</h4>
          <div className="mt-3">
            <StoragePeakGrid peaks={summary.storagePeaks} />
          </div>
        </div>
      ) : null}
      <div>
        <h4 className="text-sm font-medium text-[var(--c9-text)]">Components</h4>
        <ul className="mt-3 space-y-1">
          {Object.entries(summary.componentSummaries).map(([nodeId, c]) => (
            <li
              key={nodeId}
              className="flex items-center justify-between gap-3 border-b border-[var(--c9-border)] py-2 text-xs last:border-b-0"
            >
              <span className="text-[var(--c9-text)]">{c.label}</span>
              <span className="shrink-0 font-mono text-[var(--c9-muted)]">
                CPU {c.cpuSummary} · Mem {c.memSummary}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StoragePeakGrid({
  peaks,
  compact = false,
}: {
  peaks: NonNullable<SessionSummary['storagePeaks']>
  compact?: boolean
}) {
  const rows = [
    { label: 'Peak read rate', value: fmtRate(peaks.readRate) },
    { label: 'Peak write rate', value: fmtRate(peaks.writeRate) },
    { label: 'Peak read latency', value: fmtMs(peaks.readLatencyMs) },
    { label: 'Peak write latency', value: fmtMs(peaks.writeLatencyMs) },
    { label: 'Peak utilization', value: fmtPct(peaks.utilizationPct) },
    { label: 'Peak store errors', value: fmtRate(peaks.errorRate) },
  ]
  return (
    <dl className={`grid gap-x-6 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {rows.map((row) => (
        <div key={row.label} className="border-t border-[var(--c9-border)] py-2">
          <dt className="text-[10px] uppercase tracking-wider text-[var(--c9-muted)]">
            {row.label}
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums text-[var(--c9-text)]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-[var(--c9-muted)]">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-[var(--c9-text-heading)]">{value}</dd>
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
      usedLoadgen: summary.peakRps > 0 || summary.totalRequests > 0,
    })
  }, [summary])

  if (!summary) return null

  const redeploy = () => {
    dismiss()
    dispatchRequestDeploy()
  }

  return (
    <SessionSummaryView
      summary={summary}
      onDismiss={dismiss}
      onRedeploy={redeploy}
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
