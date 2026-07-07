import { describe, expect, it } from 'vitest'
import type { TemplateInfo } from './api'
import { selectTemplatePreset } from './selectTemplatePreset'

const template: TemplateInfo = {
  id: 'url-shortener',
  name: 'URL Shortener',
  description: '',
  components: 3,
  bottleneck: '',
  available: true,
  premium: false,
  simulatable: true,
  deployable: true,
  tags: [],
  preset: { nodes: [{ id: 'lb', type: 'load_balancer', position: [0, 0, 0], label: 'LB', config: {} }], edges: [] },
  presetLite: { nodes: [{ id: 'app', type: 'compute', position: [0, 0, 0], label: 'App', config: {} }], edges: [] },
}

describe('selectTemplatePreset', () => {
  it('uses presetLite for free users', () => {
    const got = selectTemplatePreset(template, {
      isInternal: false,
      isPremium: false,
      premiumExpiresAt: null,
    })
    expect(got?.nodes[0]?.id).toBe('app')
  })

  it('uses full preset for engineer users', () => {
    const got = selectTemplatePreset(template, {
      isInternal: false,
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    expect(got?.nodes[0]?.id).toBe('lb')
  })

  it('falls back to preset when presetLite is absent', () => {
    const pullOnly = { ...template, presetLite: undefined, id: 'social-feed-pull' }
    const got = selectTemplatePreset(pullOnly, null)
    expect(got?.nodes[0]?.id).toBe('lb')
  })
})
