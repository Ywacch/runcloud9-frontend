import { describe, expect, it } from 'vitest'
import {
  parseThreadServedBy,
  parseUserPoolUserIds,
  isSocialFeedTemplate,
} from './playgroundProxyModel'

describe('parseUserPoolUserIds', () => {
  it('returns up to 50 digit ids as strings', () => {
    const ids = parseUserPoolUserIds({ userIds: [1, 2, '3'] })
    expect(ids).toEqual(['1', '2', '3'])
  })
})

describe('parseThreadServedBy', () => {
  it('reads servedBy from a thread JSON body', () => {
    const sb = parseThreadServedBy(
      JSON.stringify({
        rootId: 1,
        servedBy: { replies: 'replica-a', parents: 'replica-b' },
      }),
    )
    expect(sb).toEqual({ replies: 'replica-a', parents: 'replica-b' })
  })
})

describe('isSocialFeedTemplate', () => {
  it('matches social-feed variants', () => {
    expect(isSocialFeedTemplate('social-feed')).toBe(true)
    expect(isSocialFeedTemplate('social-feed-pull')).toBe(true)
    expect(isSocialFeedTemplate('url-shortener')).toBe(false)
  })
})
