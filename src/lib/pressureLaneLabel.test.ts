import { describe, expect, it } from 'vitest'
import { pressureLaneLabel, usersFieldHint } from './pressureLaneLabel'

describe('pressureLaneLabel', () => {
  it('returns empty when no identity count', () => {
    expect(pressureLaneLabel({ rps: 50, identityCount: null, conversationVUs: null })).toBe(
      '',
    )
    expect(pressureLaneLabel({ rps: 50, identityCount: 0, conversationVUs: null })).toBe('')
  })

  it('formats users and rps from server count', () => {
    expect(
      pressureLaneLabel({ rps: 220, identityCount: 60, conversationVUs: null }),
    ).toBe('60 users at 220 RPS')
  })

  it('appends conversation VU count', () => {
    expect(
      pressureLaneLabel({ rps: 220, identityCount: 60, conversationVUs: 5 }),
    ).toBe('60 users at 220 RPS · 5 in conversations')
  })
})

describe('usersFieldHint', () => {
  it('returns null when not running', () => {
    expect(
      usersFieldHint({
        running: false,
        requested: 500,
        identityCount: 60,
        identitiesSeen: 10,
      }),
    ).toBeNull()
  })

  it('warns when requested exceeds dataset', () => {
    expect(
      usersFieldHint({
        running: true,
        requested: 10000,
        identityCount: 5000,
        identitiesSeen: null,
      }),
    ).toBe('Only 5,000 users available')
  })

  it('shows seen count', () => {
    expect(
      usersFieldHint({
        running: true,
        requested: null,
        identityCount: 60,
        identitiesSeen: 42,
      }),
    ).toBe('42 of 60 used so far')
  })

  it('joins cap and seen', () => {
    expect(
      usersFieldHint({
        running: true,
        requested: 10000,
        identityCount: 5000,
        identitiesSeen: 42,
      }),
    ).toBe('Only 5,000 users available · 42 of 5,000 used so far')
  })
})
