import { describe, expect, it } from 'vitest'
import { parseAIPostmortem } from './aiPostmortem'

describe('parseAIPostmortem', () => {
  it('reads claims, summary, and request id', () => {
    const parsed = parseAIPostmortem({
      status: 'ok',
      summary: 'Cache flush saturated the database.',
      claims: [
        {
          scope: 'pair',
          components: ['cache', 'db'],
          aspect: 'why',
          text: 'Reads fell through after the flush.',
          factRefs: ['fact:rule:cascade_cache_db'],
          grounding: 'inferred',
          requestId: 'req-9',
        },
      ],
      insufficientEvidence: ['replica lag sample'],
    })
    expect(parsed?.status).toBe('ok')
    expect(parsed?.claims).toHaveLength(1)
    expect(parsed?.claims[0].grounding).toBe('inferred')
    expect(parsed?.claims[0].requestId).toBe('req-9')
    expect(parsed?.insufficientEvidence).toEqual(['replica lag sample'])
  })

  it('drops claims that lack grounding', () => {
    const parsed = parseAIPostmortem({
      status: 'ok',
      summary: 'Steady.',
      claims: [{ scope: 'component', aspect: 'what', text: 'no grounding' }],
    })
    expect(parsed?.claims).toEqual([])
    expect(parsed?.summary).toBe('Steady.')
  })

  it('returns null when the payload has nothing to show', () => {
    expect(parseAIPostmortem(null)).toBeNull()
    expect(parseAIPostmortem({ status: 'skipped' })).toBeNull()
  })

  it('parses pending-only payload', () => {
    const parsed = parseAIPostmortem({ status: 'pending', requestedAt: '2026-01-01T00:00:00Z' })
    expect(parsed?.status).toBe('pending')
    expect(parsed?.summary).toBe('')
  })

  it('parses error-only payload', () => {
    const parsed = parseAIPostmortem({ status: 'error', generatedAt: '2026-01-01T00:00:00Z' })
    expect(parsed?.status).toBe('error')
  })
})
