import { describe, expect, it } from 'vitest'
import {
  canShowTimelineView,
  formatRelativeTime,
  matchRedisPattern,
  parseTimelineMember,
} from './timelineMember'

describe('matchRedisPattern', () => {
  it('matches timeline glob patterns', () => {
    expect(matchRedisPattern('timeline:3', 'timeline:*')).toBe(true)
    expect(matchRedisPattern('feed:3', 'timeline:*')).toBe(false)
    expect(matchRedisPattern('timeline:3', '*')).toBe(true)
  })
})

describe('parseTimelineMember', () => {
  it('requires content and author_id', () => {
    expect(
      parseTimelineMember(
        JSON.stringify({
          author_id: 3,
          content: 'Load test post 23730',
          created_at: 1_700_000_000,
        }),
      ),
    ).toEqual({
      authorId: '3',
      content: 'Load test post 23730',
      createdAt: 1_700_000_000_000,
    })
    expect(parseTimelineMember(JSON.stringify({ content: 'x' }))).toBeNull()
    expect(parseTimelineMember('not-json')).toBeNull()
  })
})

describe('canShowTimelineView', () => {
  const member = JSON.stringify({
    author_id: 10,
    content: 'hello',
    created_at: '2024-01-01T00:00:00Z',
  })

  it('shows toggle for matching zset timeline keys', () => {
    expect(
      canShowTimelineView({
        key: 'timeline:10',
        type: 'zset',
        value: [[member, 1700000000]],
        keyPatterns: ['timeline:*', 'session:*'],
      }),
    ).toBe(true)
  })

  it('hides toggle when type or payload is wrong', () => {
    expect(
      canShowTimelineView({
        key: 'timeline:10',
        type: 'string',
        value: member,
        keyPatterns: ['timeline:*'],
      }),
    ).toBe(false)
    expect(
      canShowTimelineView({
        key: 'timeline:10',
        type: 'zset',
        value: [['plain-string', 1]],
        keyPatterns: ['timeline:*'],
      }),
    ).toBe(false)
    expect(
      canShowTimelineView({
        key: 'session:10',
        type: 'zset',
        value: [[member, 1]],
        keyPatterns: ['timeline:*'],
      }),
    ).toBe(false)
  })

  it('falls back to timeline: prefix when patterns are only *', () => {
    expect(
      canShowTimelineView({
        key: 'timeline:1',
        type: 'zset',
        value: [[member, 1]],
        keyPatterns: ['*'],
      }),
    ).toBe(true)
    expect(
      canShowTimelineView({
        key: 'cache:user:1',
        type: 'zset',
        value: [[member, 1]],
        keyPatterns: ['*'],
      }),
    ).toBe(false)
  })
})

describe('formatRelativeTime', () => {
  it('formats compact ages without em dashes', () => {
    const now = Date.parse('2024-06-01T12:00:00Z')
    expect(formatRelativeTime(now - 10_000, now)).toBe('just now')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(formatRelativeTime(now - 3 * 3600_000, now)).toBe('3h ago')
    expect(formatRelativeTime(null, now)).toBe('just now')
  })
})
