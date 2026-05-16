import type { WsEvent } from '../store/metricsStore'

const SEVERITY_RANK: Record<string, number> = {
  cascade: 0,
  threshold: 1,
  action: 2,
}

export function eventSeverityRank(type: string): number {
  return SEVERITY_RANK[type] ?? 3
}

export type TimelineEventSort = 'severity' | 'time'

const TIMELINE_SORT_STORAGE_KEY = 'c9-event-timeline-sort'

export function readTimelineEventSort(): TimelineEventSort {
  try {
    const v = sessionStorage.getItem(TIMELINE_SORT_STORAGE_KEY)
    if (v === 'time' || v === 'severity') return v
  } catch {
    /* ignore */
  }
  return 'severity'
}

export function writeTimelineEventSort(mode: TimelineEventSort): void {
  try {
    sessionStorage.setItem(TIMELINE_SORT_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

function compareByTimestampDesc(a: WsEvent, b: WsEvent): number {
  const ta = Date.parse(a.timestamp)
  const tb = Date.parse(b.timestamp)
  const dt = tb - ta
  if (dt !== 0) return dt
  return a.title.localeCompare(b.title)
}

/** Newest first (left in the horizontal strip). */
export function sortEventsByTime(events: WsEvent[]): WsEvent[] {
  return [...events].sort(compareByTimestampDesc)
}

/** Cascade first, then threshold, then action; newest first within each tier. */
export function sortEventsBySeverityThenTime(events: WsEvent[]): WsEvent[] {
  return [...events].sort((a, b) => {
    const dr = eventSeverityRank(a.type) - eventSeverityRank(b.type)
    if (dr !== 0) return dr
    return compareByTimestampDesc(a, b)
  })
}

export function sortTimelineEvents(
  events: WsEvent[],
  mode: TimelineEventSort,
): WsEvent[] {
  return mode === 'time'
    ? sortEventsByTime(events)
    : sortEventsBySeverityThenTime(events)
}
