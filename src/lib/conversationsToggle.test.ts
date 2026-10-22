import { describe, expect, it } from 'vitest'
import {
  conversationLaneSummary,
  conversationsDefaultOn,
  replicaStaggerMs,
} from './conversationsToggle'

describe('replicaStaggerMs', () => {
  it('returns 0 with fewer than 2 replicas', () => {
    expect(replicaStaggerMs(0, '0,1500')).toBe(0)
    expect(replicaStaggerMs(1, '0,1500')).toBe(0)
  })

  it('parses stagger from canvas delay shapes', () => {
    expect(replicaStaggerMs(2, undefined)).toBe(0)
    expect(replicaStaggerMs(2, '')).toBe(0)
    expect(replicaStaggerMs(2, '1500')).toBe(0)
    expect(replicaStaggerMs(2, '1500,1500')).toBe(0)
    expect(replicaStaggerMs(2, '0,1500')).toBe(1500)
    expect(replicaStaggerMs(2, [0, 1500])).toBe(1500)
    expect(replicaStaggerMs(2, '0,1500,3000')).toBe(0)
  })
})

describe('conversationsDefaultOn', () => {
  it('is on only with staggered replicas', () => {
    expect(
      conversationsDefaultOn({
        conversationsOffered: true,
        readReplicas: 2,
        replicaApplyDelayMs: '0,1500',
      }),
    ).toBe(true)
    expect(
      conversationsDefaultOn({
        conversationsOffered: true,
        readReplicas: 0,
        replicaApplyDelayMs: '0,1500',
      }),
    ).toBe(false)
    expect(
      conversationsDefaultOn({
        conversationsOffered: true,
        readReplicas: 2,
        replicaApplyDelayMs: '1500,1500',
      }),
    ).toBe(false)
    expect(
      conversationsDefaultOn({
        conversationsOffered: false,
        readReplicas: 2,
        replicaApplyDelayMs: '0,1500',
      }),
    ).toBe(false)
  })
})

describe('conversationLaneSummary', () => {
  it('returns null without vu stats', () => {
    expect(conversationLaneSummary(null)).toBeNull()
    expect(conversationLaneSummary(undefined)).toBeNull()
  })

  it('sums lane stats with missing numbers as zero', () => {
    expect(
      conversationLaneSummary({
        behaviors: {
          conversation_starter: { vus: 2, requests: 12 },
          replier: { vus: 2 },
        },
        observer: {},
      }),
    ).toBe('4 in conversations · 12 posts · 0 replies · 0 thread reads')
  })
})
