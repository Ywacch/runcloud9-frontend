import type { WsEvent } from '../store/metricsStore'

const SEVERITY_RANK: Record<string, number> = {
  cascade: 0,
  threshold: 1,
  action: 2,
}

export function eventSeverityRank(type: string): number {
  return SEVERITY_RANK[type] ?? 3
}

/** Cascade first, then threshold, then action; newest first within each tier. */
export function sortEventsBySeverityThenTime(events: WsEvent[]): WsEvent[] {
  return [...events].sort((a, b) => {
    const dr = eventSeverityRank(a.type) - eventSeverityRank(b.type)
    if (dr !== 0) return dr
    return Date.parse(b.timestamp) - Date.parse(a.timestamp)
  })
}
