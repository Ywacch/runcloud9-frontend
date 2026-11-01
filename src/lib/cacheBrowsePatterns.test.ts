import { describe, expect, it } from 'vitest'
import { cacheBrowsePatterns, cachePatternLabel } from './cacheBrowsePatterns'

describe('cacheBrowsePatterns', () => {
  it('keeps timeline patterns when the queue stays on RabbitMQ', () => {
    expect(cacheBrowsePatterns(['timeline:*'], ['fanout'], false)).toEqual(['timeline:*'])
  })

  it('appends the stream key when the work queue is Redis', () => {
    expect(cacheBrowsePatterns(['timeline:*'], ['fanout'], true)).toEqual([
      'timeline:*',
      'fanout',
    ])
  })

  it('does not duplicate a stream key already listed', () => {
    expect(cacheBrowsePatterns(['timeline:*', 'fanout'], [' fanout '], true)).toEqual([
      'timeline:*',
      'fanout',
    ])
  })
})

describe('cachePatternLabel', () => {
  it('names timeline and work-queue patterns', () => {
    expect(cachePatternLabel('timeline:*', ['fanout'])).toBe('Timelines')
    expect(cachePatternLabel('fanout', ['fanout'])).toBe('Work queue')
    expect(cachePatternLabel('orders', ['fanout', 'orders'])).toBe('Work queue · orders')
  })
})
