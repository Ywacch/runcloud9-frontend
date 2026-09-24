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

  it('parses verified caption with grounding from API', () => {
    const out = parseEventsSummary([
      {
        timestamp: '2026-01-01T12:00:00Z',
        type: 'cascade',
        ruleId: 'cascade_cache_db',
        narrative: 'Authored fallback',
        caption: {
          text: 'Cache misses saturated the pool.',
          grounding: 'inferred',
          factRefs: ['fact:rule:cascade_cache_db'],
        },
      },
    ])
    expect(out[0].caption?.text).toBe('Cache misses saturated the pool.')
    expect(out[0].caption?.grounding).toBe('inferred')
    expect(out[0].caption?.factRefs).toEqual(['fact:rule:cascade_cache_db'])
  })

  it('parses ruleId for invariant events', () => {
    const out = parseEventsSummary([
      {
        timestamp: '2026-01-01T12:00:00Z',
        type: 'invariant',
        ruleId: 'oversell',
        narrative: 'Sold exceeded capacity',
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].rule).toBe('oversell')
    expect(out[0].type).toBe('invariant')
  })
})
