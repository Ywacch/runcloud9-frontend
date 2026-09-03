import { describe, expect, it } from 'vitest'
import type { TemplateInfo } from './api'
import {
  designHasEngineerOnlyNodes,
  explorerFullModeDeployBlock,
  selectTemplatePreset,
  templateHasExplorerRunnable,
} from './templatePresetMode'
import { SWITCH_TO_FREE_TIER_DESIGN_LABEL } from './billingCopy'
import {
  engineerLockedNodeOpacity,
  isEngineerPreviewLocked,
} from './engineerLockedVisual'

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
  preset: {
    nodes: [
      {
        id: 'lb',
        type: 'load_balancer',
        position: [0, 0, 0],
        label: 'LB',
        config: {},
      },
    ],
    edges: [],
  },
  presetLite: {
    nodes: [
      {
        id: 'app',
        type: 'compute',
        position: [0, 0, 0],
        label: 'App',
        config: {},
      },
    ],
    edges: [],
  },
}

const freeUser = {
  isInternal: false,
  isPremium: false,
  premiumExpiresAt: null,
}

const engineerUser = {
  isInternal: false,
  isPremium: true,
  premiumExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
}

describe('templatePresetMode', () => {
  it('defaults free users to full preset', () => {
    expect(selectTemplatePreset(template, freeUser)?.nodes[0]?.id).toBe('lb')
    expect(selectTemplatePreset(template, freeUser, 'full')?.nodes[0]?.id).toBe(
      'lb',
    )
  })

  it('uses presetLite for explorer mode', () => {
    expect(
      selectTemplatePreset(template, freeUser, 'explorer')?.nodes[0]?.id,
    ).toBe('app')
  })

  it('always uses full preset for paid users', () => {
    expect(
      selectTemplatePreset(template, engineerUser, 'explorer')?.nodes[0]?.id,
    ).toBe('lb')
  })

  it('detects engineer-only nodes and soft-blocks full mode deploy', () => {
    expect(
      designHasEngineerOnlyNodes({
        a: { type: 'compute' },
        b: { type: 'load_balancer' },
      }),
    ).toBe(true)
    const block = explorerFullModeDeployBlock({
      isFreeUser: true,
      mode: 'full',
      nodes: { b: { type: 'load_balancer' } },
      billingEnabled: true,
      hasExplorerRunnable: true,
    })
    expect(block?.secondaryActionLabel).toBe(SWITCH_TO_FREE_TIER_DESIGN_LABEL)
    expect(block?.actionLabel).toBeUndefined()
    expect(
      explorerFullModeDeployBlock({
        isFreeUser: true,
        mode: 'explorer',
        nodes: { b: { type: 'load_balancer' } },
        billingEnabled: true,
        hasExplorerRunnable: true,
      }),
    ).toBeNull()
    expect(
      explorerFullModeDeployBlock({
        isFreeUser: true,
        mode: 'full',
        nodes: { b: { type: 'load_balancer' } },
        billingEnabled: true,
        hasExplorerRunnable: false,
      })?.secondaryActionLabel,
    ).toBeUndefined()
  })

  it('reports explorer runnable availability', () => {
    expect(templateHasExplorerRunnable(template)).toBe(true)
    expect(
      templateHasExplorerRunnable({ preset: template.preset, presetLite: undefined }),
    ).toBe(false)
  })
})

describe('engineerLockedVisual', () => {
  it('no longer mutes engineer-only nodes after launch limits', () => {
    expect(
      engineerLockedNodeOpacity({
        nodeType: 'load_balancer',
        isFreeUser: true,
        mode: 'full',
      }),
    ).toBe(1)
    expect(
      isEngineerPreviewLocked({
        nodeType: 'load_balancer',
        isFreeUser: true,
        mode: 'full',
      }),
    ).toBe(false)
  })
})
