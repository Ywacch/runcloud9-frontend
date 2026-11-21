import { describe, expect, it } from 'vitest'
import {
  nodeChromeAnchors,
  nodeLabelFill,
  replicaBadgeText,
  REPLICA_BADGE_FILL,
  shouldShowProvisionedSublabel,
  statusDotColor,
} from './nodeChrome'
import { defaultTopology, emptyConfig, type SvgNode } from '../store/svgTypes'

function node(partial: Partial<SvgNode> & Pick<SvgNode, 'archetype'>): SvgNode {
  return {
    id: 'n1',
    engine: 'generic',
    x: 0,
    y: 0,
    label: 'T1',
    config: emptyConfig(),
    topology: defaultTopology(),
    ...partial,
  }
}

describe('nodeChrome', () => {
  it('shows provisioned sublabels in design and simulate only', () => {
    expect(shouldShowProvisionedSublabel('design')).toBe(true)
    expect(shouldShowProvisionedSublabel('simulate')).toBe(true)
    expect(shouldShowProvisionedSublabel('live')).toBe(false)
  })

  it('formats replica badges like Pixi', () => {
    expect(replicaBadgeText(node({ archetype: 'app-server' }))).toBeNull()
    expect(
      replicaBadgeText(
        node({
          archetype: 'app-server',
          topology: { replicas: 3, shards: 1, packing: 'stack' },
        }),
      ),
    ).toBe('×3')
    expect(
      replicaBadgeText(
        node({
          archetype: 'database',
          topology: { replicas: 3, shards: 1, packing: 'stack' },
        }),
      ),
    ).toBe('+2 read')
    expect(
      replicaBadgeText(
        node({
          archetype: 'load-balancer',
          topology: { replicas: 3, shards: 1, packing: 'stack' },
        }),
      ),
    ).toBeNull()
  })

  it('colors warning names amber and error names red', () => {
    expect(nodeLabelFill('warning')).toBe('#e0a64b')
    expect(nodeLabelFill('error')).toBe('#e0405c')
    expect(nodeLabelFill('healthy')).toBe('#ffffff')
    expect(nodeLabelFill('idle')).toBe('#ffffff')
    expect(REPLICA_BADGE_FILL).toBe('#7fcdb9')
  })

  it('maps status colors', () => {
    expect(statusDotColor('healthy')).toBe('#22c55e')
    expect(statusDotColor('provisioning')).toBe('#fbbf24')
    expect(statusDotColor('degraded')).toBe('#ef4444')
    expect(statusDotColor(undefined)).toBe('#475569')
  })

  it('anchors label above the glyph art box', () => {
    const a = nodeChromeAnchors(node({ archetype: 'database', x: 100, y: 50 }))
    expect(a.labelY).toBeLessThan(50)
    expect(a.statusX).toBeGreaterThan(a.labelX)
  })
})
