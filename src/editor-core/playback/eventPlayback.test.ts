import { describe, expect, it, beforeEach } from 'vitest'
import type { WsEvent } from '../stores/metricsStore'
import {
  enqueuePlaybackEvents,
  eventDedupeKey,
  firePlaybackEventsUpTo,
  markEventsFired,
  pendingPlaybackEventCount,
  resetEventPlayback,
} from './eventPlayback'

function event(iso: string, title: string): WsEvent {
  return {
    timestamp: iso,
    type: 'threshold',
    source: 'metrics',
    title,
    description: '',
  }
}

describe('eventPlayback', () => {
  beforeEach(() => {
    resetEventPlayback()
  })

  it('does not fire events before playhead reaches their timestamp', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    enqueuePlaybackEvents([event(future, 'future')], Date.now())
    expect(firePlaybackEventsUpTo(Date.now())).toHaveLength(0)
    expect(pendingPlaybackEventCount()).toBe(1)
  })

  it('fires events when playhead crosses timestamp', () => {
    const past = new Date(Date.now() - 10_000).toISOString()
    enqueuePlaybackEvents([event(past, 'past')], Date.now() - 20_000)
    const fired = firePlaybackEventsUpTo(Date.now())
    expect(fired).toHaveLength(1)
    expect(fired[0]!.title).toBe('past')
    expect(pendingPlaybackEventCount()).toBe(0)
  })

  it('fires stale events immediately on ingest when playhead is ahead', () => {
    const old = new Date(Date.now() - 30_000).toISOString()
    const playhead = Date.now()
    const fired = enqueuePlaybackEvents([event(old, 'old')], playhead)
    expect(fired).toHaveLength(1)
  })

  it('does not refire deduped events', () => {
    const ev = event('2026-01-01T00:00:00.000Z', 'once')
    markEventsFired([ev])
    enqueuePlaybackEvents([ev], Date.now() + 60_000)
    expect(pendingPlaybackEventCount()).toBe(0)
    expect(eventDedupeKey(ev)).toBe('2026-01-01T00:00:00.000Z|threshold|once')
  })
})
