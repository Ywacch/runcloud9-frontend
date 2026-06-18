import { useMetricsStore, type WsEvent } from '../stores/metricsStore'
import { registerChaosFromEvents } from './wsMetricsFrame'

interface PendingEvent {
  id: string
  event: WsEvent
  eventMs: number
}

const pending: PendingEvent[] = []
const firedIds = new Set<string>()

export function eventDedupeKey(event: WsEvent): string {
  return `${event.timestamp}|${event.type}|${event.title}`
}

export function parseEventMs(event: WsEvent): number {
  const t = Date.parse(event.timestamp)
  return Number.isFinite(t) ? t : 0
}

/** Mark events already on the timeline (e.g. sessionStorage restore) as fired. */
export function markEventsFired(events: WsEvent[]): void {
  for (const event of events) {
    firedIds.add(eventDedupeKey(event))
  }
}

export function enqueuePlaybackEvents(
  events: WsEvent[],
  playheadMs: number,
): WsEvent[] {
  for (const event of events) {
    const id = eventDedupeKey(event)
    if (firedIds.has(id)) continue
    if (pending.some((p) => p.id === id)) continue
    pending.push({ id, event, eventMs: parseEventMs(event) })
  }
  pending.sort((a, b) => a.eventMs - b.eventMs)
  return firePlaybackEventsUpTo(playheadMs)
}

export function firePlaybackEventsUpTo(playheadMs: number): WsEvent[] {
  if (pending.length === 0) return []

  const toFire: WsEvent[] = []
  const remaining: PendingEvent[] = []

  for (const item of pending) {
    if (firedIds.has(item.id)) continue
    if (item.eventMs <= playheadMs) {
      firedIds.add(item.id)
      toFire.push(item.event)
    } else {
      remaining.push(item)
    }
  }

  pending.length = 0
  pending.push(...remaining)

  if (toFire.length > 0) {
    useMetricsStore.getState().pushEvents(toFire)
    registerChaosFromEvents(toFire)
  }

  return toFire
}

export function clearPendingPlaybackEvents(): void {
  pending.length = 0
}

export function resetEventPlayback(): void {
  pending.length = 0
  firedIds.clear()
}

export function pendingPlaybackEventCount(): number {
  return pending.length
}
