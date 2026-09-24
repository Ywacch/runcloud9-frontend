import { describe, expect, it } from 'vitest'
import {
  highlightDisplayBody,
  highlightEventSearchText,
  showModelInferenceBadge,
} from './highlightCaption'
import type { SessionEventSummary } from './eventsSummaryFromApi'

const baseEvent: SessionEventSummary = {
  timestamp: '2026-01-01T12:00:00Z',
  type: 'cascade',
  rule: 'cascade_cache_db',
  narrative: 'Authored narrative from detectors.',
}

describe('highlightCaption', () => {
  it('prefers verified caption text over narrative', () => {
    const event: SessionEventSummary = {
      ...baseEvent,
      caption: { text: 'Model caption text.', grounding: 'authored' },
    }
    expect(highlightDisplayBody(event)).toBe('Model caption text.')
  })

  it('shows model inference badge only for inferred grounding', () => {
    expect(showModelInferenceBadge(baseEvent)).toBe(false)
    expect(
      showModelInferenceBadge({
        ...baseEvent,
        caption: { text: 'x', grounding: 'authored' },
      }),
    ).toBe(false)
    expect(
      showModelInferenceBadge({
        ...baseEvent,
        caption: { text: 'x', grounding: 'inferred' },
      }),
    ).toBe(true)
  })

  it('includes caption text in session summary search tokens', () => {
    const event: SessionEventSummary = {
      ...baseEvent,
      caption: { text: 'redis eviction spike', grounding: 'inferred' },
    }
    expect(highlightEventSearchText(event)).toContain('redis eviction spike')
  })
})
