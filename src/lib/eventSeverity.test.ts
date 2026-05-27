import { describe, expect, it } from 'vitest'
import type { WsEvent } from '../editor-core/stores/metricsStore'
import {
  sortEventsBySeverityThenTime,
  sortEventsByTime,
  sortTimelineEvents,
} from './eventSeverity'

function ev(
  type: string,
  timestamp: string,
  title = type,
): WsEvent {
  return {
    type,
    timestamp,
    source: 'test',
    title,
    description: '',
  }
}

describe('sortEventsByTime', () => {
  it('orders oldest first', () => {
    const events = [
      ev('action', '2026-01-01T10:00:00Z'),
      ev('cascade', '2026-01-01T12:00:00Z'),
      ev('threshold', '2026-01-01T11:00:00Z'),
    ]
    const sorted = sortEventsByTime(events)
    expect(sorted.map((e) => e.timestamp)).toEqual([
      '2026-01-01T10:00:00Z',
      '2026-01-01T11:00:00Z',
      '2026-01-01T12:00:00Z',
    ])
  })
})

describe('sortEventsBySeverityThenTime', () => {
  it('groups by severity then newest within tier', () => {
    const events = [
      ev('action', '2026-01-01T12:00:00Z'),
      ev('cascade', '2026-01-01T10:00:00Z'),
      ev('cascade', '2026-01-01T11:00:00Z'),
      ev('threshold', '2026-01-01T09:00:00Z'),
    ]
    const sorted = sortEventsBySeverityThenTime(events)
    expect(sorted.map((e) => `${e.type}:${e.timestamp}`)).toEqual([
      'cascade:2026-01-01T11:00:00Z',
      'cascade:2026-01-01T10:00:00Z',
      'threshold:2026-01-01T09:00:00Z',
      'action:2026-01-01T12:00:00Z',
    ])
  })
})

describe('sortTimelineEvents', () => {
  it('delegates to time sort when mode is time', () => {
    const events = [
      ev('cascade', '2026-01-01T10:00:00Z'),
      ev('action', '2026-01-01T12:00:00Z'),
    ]
    expect(sortTimelineEvents(events, 'time').map((e) => e.type)).toEqual([
      'cascade',
      'action',
    ])
  })
})
