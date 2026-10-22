import { describe, expect, it } from 'vitest'
import { pressureLaneLabel } from './pressureLaneLabel'

describe('pressureLaneLabel', () => {
  it('returns empty when no user cap', () => {
    expect(pressureLaneLabel({ rps: 50, activeUsers: null, conversationVUs: null })).toBe(
      '',
    )
    expect(pressureLaneLabel({ rps: 50, activeUsers: 0, conversationVUs: null })).toBe('')
  })

  it('formats users and rps', () => {
    expect(
      pressureLaneLabel({ rps: 50, activeUsers: 500, conversationVUs: null }),
    ).toBe('500 users at 50 RPS')
  })

  it('appends conversation VU count', () => {
    expect(
      pressureLaneLabel({ rps: 50, activeUsers: 500, conversationVUs: 5 }),
    ).toBe('500 users at 50 RPS · 5 in conversations')
  })
})
