import { describe, expect, it, vi } from 'vitest'
import { isoToScreen } from '../math/iso'
import { composeExpandedFanUnits } from '../compose/expandedSlots'
import { liveZonesForNodes } from './liveZonesForNodes'
import {
  emptyConfig,
  type SvgNode,
} from '../store/svgTypes'

vi.mock('../store/expandStore', () => ({
  getExpanded: vi.fn(() => true),
}))

function stackNode(replicas: number): SvgNode {
  const p = isoToScreen(0.5, -0.5)
  return {
    id: 'app1',
    archetype: 'app-server',
    engine: 'generic',
    x: p.x,
    y: p.y,
    label: 'App',
    config: emptyConfig(),
    topology: { replicas, shards: 1, packing: 'stack' },
  }
}

describe('liveZonesForNodes', () => {
  it('synthesizes a zone for expanded multi-unit stacks without stored zones', () => {
    const node = stackNode(3)
    const zones = liveZonesForNodes([], [node], null)
    expect(zones).toHaveLength(1)
    expect(zones[0]?.ownerNodeId).toBe('app1')
    expect(zones[0]?.label).toBe('×3')
  })

  it('returns no zones for collapsed stacks', async () => {
    const { getExpanded } = await import('../store/expandStore')
    vi.mocked(getExpanded).mockReturnValueOnce(false)

    const zones = liveZonesForNodes([], [stackNode(3)], null)
    expect(zones).toEqual([])
  })

  it('uses fanned unit offsets for expanded stack zones', () => {
    const node = stackNode(3)
    const zones = liveZonesForNodes([], [node], null)
    const expectedUnits = composeExpandedFanUnits(3)
    expect(zones[0]?.cols).toBeGreaterThan(2)
    expect(expectedUnits.length).toBe(3)
  })
})
