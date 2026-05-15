import { describe, expect, it } from 'vitest'
import { parseEventsSummary } from './eventsSummaryFromApi'

describe('parseEventsSummary', () => {
  it('parses flat events_summary array', () => {
    const out = parseEventsSummary([
      {
        timestamp: '2026-01-01T12:00:00Z',
        type: 'cascade',
        rule: 'mq-backpressure',
        narrative: 'Queue depth exceeded',
        suggestion: 'Scale workers',
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].rule).toBe('mq-backpressure')
    expect(out[0].type).toBe('cascade')
  })

  it('falls back to title when rule missing', () => {
    const out = parseEventsSummary([{ type: 'threshold', title: 'High CPU' }])
    expect(out[0].rule).toBe('High CPU')
  })
})
