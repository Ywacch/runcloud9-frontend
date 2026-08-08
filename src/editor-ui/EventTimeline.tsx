import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  readTimelineEventSort,
  sortTimelineEvents,
  writeTimelineEventSort,
  type TimelineEventSort,
} from '../lib/eventSeverity'
import { backendComponentToCanvasType } from '../lib/typeMapping'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useMetricsStore, type WsEvent } from '../editor-core/stores/metricsStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { NarrativeCard } from './NarrativeCard'

function formatTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function pillClass(event: WsEvent): string {
  if (event.kind === 'chaos_inject' || event.source === 'chaos')
    return 'bg-violet-950/80 text-violet-100 ring-violet-700/50'
  if (event.kind === 'loadgen_start')
    return 'bg-emerald-950/80 text-emerald-100 ring-emerald-700/50'
  if (event.kind === 'loadgen_stop')
    return 'bg-slate-900/80 text-slate-100 ring-slate-700/50'
  if (event.type === 'cascade') return 'bg-red-950/80 text-red-100 ring-red-800/50'
  if (event.type === 'threshold')
    return 'bg-amber-950/80 text-amber-100 ring-amber-800/50'
  return 'bg-[var(--c9-badge-bg)] text-[var(--c9-text)] ring-[var(--c9-border)]'
}

function workloadAnchorLabel(event: WsEvent): string | null {
  switch (event.kind) {
    case 'loadgen_start':
      return 'load start'
    case 'loadgen_stop':
      return 'load stop'
    case 'chaos_inject':
      return 'chaos'
    default:
      return null
  }
}

function eventTooltip(event: WsEvent): string {
  const detail = event.detail
    ? Object.entries(event.detail)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · ')
    : ''
  return [event.description || event.title, detail].filter(Boolean).join('\n')
}

/**
 * Event strip with user-selectable sort: importance (severity) or time (oldest first).
 * Click a pill: opens narrative when present, else selects the related canvas node.
 */
export function EventTimeline() {
  const events = useMetricsStore((s) => s.events)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const restorePredicted = useStorytellingStore((s) => s.restorePersistedPredictions)
  const isPredicted = useStorytellingStore((s) => s.isPredicted)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const [expandedEvent, setExpandedEvent] = useState<WsEvent | null>(null)
  const [sortMode, setSortMode] = useState<TimelineEventSort>(readTimelineEventSort)
  const [stripOpen, setStripOpen] = useState(false)

  useEffect(() => {
    if (snapshotTemplateId) restorePredicted(snapshotTemplateId)
  }, [snapshotTemplateId, restorePredicted])

  const setSort = (mode: TimelineEventSort) => {
    setSortMode(mode)
    writeTimelineEventSort(mode)
  }

  const sorted = useMemo(
    () => sortTimelineEvents(events, sortMode),
    [events, sortMode],
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (sortMode === 'time') {
      el.scrollLeft = el.scrollWidth
    } else {
      el.scrollLeft = 0
    }
  }, [sorted, sortMode, stripOpen])

  const showStrip = sorted.length > 0
  if (!showStrip && !expandedEvent) return null

  const onPillClick = (e: WsEvent) => {
    if (e.narrative && e.narrative.trim()) {
      setExpandedEvent(e)
      return
    }
    const component = e.component
    if (!component) return
    const canvasType = backendComponentToCanvasType[component]
    if (!canvasType) return
    const match = Object.values(nodes)
      .filter((n) => n.type === canvasType)
      .sort((a, b) => a.id.localeCompare(b.id))[0]
    if (match) selectNode(match.id)
  }

  const pillInteractive = (e: WsEvent) =>
    Boolean((e.narrative && e.narrative.trim()) || e.component)

  return (
    <>
      {showStrip ? (
        <div className="pointer-events-auto w-full max-w-2xl">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={stripOpen}
              onClick={() => setStripOpen((v) => !v)}
              className="text-left text-[9px] font-bold uppercase tracking-wider text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
            >
              {stripOpen ? '▾' : '▸'} Events
              <span className="ml-1 font-mono font-medium normal-case tracking-normal">
                ({sorted.length})
              </span>
            </button>
            {stripOpen ? (
              <div
                role="group"
                aria-label="Sort timeline events"
                className="flex rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-px text-[9px] font-medium"
              >
                <button
                  type="button"
                  aria-pressed={sortMode === 'severity'}
                  onClick={() => setSort('severity')}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    sortMode === 'severity'
                      ? 'bg-[var(--c9-surface)] text-[var(--c9-text)] shadow-sm'
                      : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
                  }`}
                >
                  Importance
                </button>
                <button
                  type="button"
                  aria-pressed={sortMode === 'time'}
                  onClick={() => setSort('time')}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    sortMode === 'time'
                      ? 'bg-[var(--c9-surface)] text-[var(--c9-text)] shadow-sm'
                      : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
                  }`}
                >
                  Time
                </button>
              </div>
            ) : null}
          </div>
          {stripOpen ? (
            <div
              ref={scrollRef}
              className="flex max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/85 py-1.5 pl-1.5 pr-1 shadow-md backdrop-blur-md [scrollbar-width:thin]"
            >
              {sorted.map((e, i) => {
                const anchorLabel = workloadAnchorLabel(e)
                return (
                  <button
                    key={`${e.timestamp}-${i}-${e.title}`}
                    type="button"
                    title={eventTooltip(e)}
                    onClick={() => onPillClick(e)}
                    disabled={!pillInteractive(e)}
                    className={`shrink-0 max-w-[min(100%,14rem)] rounded-full px-2 py-0.5 text-left text-[10px] ring-1 transition-all duration-200 hover:brightness-110 disabled:cursor-default disabled:opacity-90 ${pillClass(e)} ${
                      pillInteractive(e) ? 'cursor-pointer' : ''
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 font-mono text-[var(--c9-muted)]">
                        {formatTime(e.timestamp)}
                      </span>
                      {anchorLabel ? (
                        <span className="rounded bg-white/10 px-1 text-[8px] font-semibold uppercase tracking-wide">
                          {anchorLabel}
                        </span>
                      ) : null}
                      <span className="text-[var(--c9-text)]">{e.title}</span>
                      {isPredicted(e) ? (
                        <span className="rounded bg-cyan-500/20 px-1 text-[8px] font-semibold uppercase text-cyan-200">
                          predicted
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {expandedEvent ? (
        <NarrativeCard
          event={expandedEvent}
          onClose={() => setExpandedEvent(null)}
        />
      ) : null}
    </>
  )
}
