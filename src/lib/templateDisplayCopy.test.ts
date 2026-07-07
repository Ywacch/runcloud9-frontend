import { describe, expect, it } from 'vitest'
import { templateDisplayCopy } from './templateDisplayCopy'

const template = {
  description: 'Full stack with LB, MQ, and worker.',
  descriptionLite: 'App, cache, and database only.',
  components: 6,
  componentsLite: 3,
  bottleneck: 'Consumer lag under high fan-out',
  bottleneckLite: 'Sync fan-out on POST scales with follower count',
}

describe('templateDisplayCopy', () => {
  it('uses lite fields for free users when descriptionLite is set', () => {
    const got = templateDisplayCopy(template, {
      isInternal: false,
      isPremium: false,
      premiumExpiresAt: null,
    })
    expect(got.description).toBe(template.descriptionLite)
    expect(got.components).toBe(3)
    expect(got.bottleneck).toBe(template.bottleneckLite)
  })

  it('uses full fields for engineer users', () => {
    const got = templateDisplayCopy(template, {
      isInternal: false,
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    expect(got.description).toBe(template.description)
    expect(got.components).toBe(6)
    expect(got.bottleneck).toBe(template.bottleneck)
  })

  it('falls back to full fields when lite metadata is absent', () => {
    const pullOnly = {
      description: 'Pull-based feed.',
      components: 2,
      bottleneck: 'Database read load',
    }
    const got = templateDisplayCopy(pullOnly, null)
    expect(got.description).toBe(pullOnly.description)
    expect(got.components).toBe(2)
  })
})
