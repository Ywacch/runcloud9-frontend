import { describe, expect, it } from 'vitest'
import { isoToScreen } from '../math/iso'
import {
  emptyConfig,
  type ReplicaPacking,
  type SvgNode,
} from '../store/svgTypes'
import { syncZoneForNode, unitObstacleAnchors } from './syncZoneForNode'

function node(
  replicas: number,
  packing: ReplicaPacking = 'stack',
  engine = 'generic',
  shards = 1,
  archetype: SvgNode['archetype'] = engine === 'redis' ? 'cache' : 'app-server',
): SvgNode {
  const p = isoToScreen(0.5, -0.5)
  return {
    id: 'n1',
    archetype,
    engine,
    x: p.x,
    y: p.y,
    label: 'T2',
    config: emptyConfig(),
    topology: { replicas, shards, packing },
  }
}

describe('syncZoneForNode', () => {
  it('returns null when replicas is 1', () => {
    expect(syncZoneForNode(node(1))).toBeNull()
  })

  it('returns null for collapsed stack even when replicas > 1', () => {
    expect(syncZoneForNode(node(3, 'stack'))).toBeNull()
  })

  it('returns a zone for expanded stack override with multiple units', () => {
    const z = syncZoneForNode(node(3, 'stack'), {
      units: [
        { dx: 0, dy: 0 },
        { dx: 28, dy: -14 },
        { dx: 56, dy: -28 },
      ],
      packing: 'stack',
      brandBody: null,
      tubeCount: 1,
    })
    expect(z).not.toBeNull()
    expect(z!.label).toBe('×3')
  })

  it('returns a zone when packing is fan and replicas > 1', () => {
    const z = syncZoneForNode(node(3, 'fan', 'redis'))
    expect(z).not.toBeNull()
    expect(z!.ownerNodeId).toBe('n1')
    expect(z!.label).toBe('×3')
    expect(z!.cols).toBeGreaterThanOrEqual(1)
    expect(z!.rows).toBeGreaterThanOrEqual(1)
  })

  it('keeps Redis ×3 zone compact (≤3.5 half-cells per side)', () => {
    const z = syncZoneForNode(node(3, 'fan', 'redis'))
    expect(z).not.toBeNull()
    // Half-cell footprint — was ~6×6 before (3×3 major).
    expect(z!.cols).toBeLessThanOrEqual(3.5)
    expect(z!.rows).toBeLessThanOrEqual(3.5)
  })

  it('keeps DB ×3 shard zone compact', () => {
    const z = syncZoneForNode(node(1, 'fan', 'postgresql', 3, 'database'))
    expect(z).not.toBeNull()
    expect(z!.label).toBe('×3')
    expect(z!.cols).toBeLessThanOrEqual(3.5)
    expect(z!.rows).toBeLessThanOrEqual(3.5)
  })

  it('keeps MQ ×4 shard zone compact', () => {
    const z = syncZoneForNode(node(1, 'fan', 'kafka', 4, 'message-queue'))
    expect(z).not.toBeNull()
    expect(z!.label).toBe('×4')
    expect(z!.cols).toBeLessThanOrEqual(4)
    expect(z!.rows).toBeLessThanOrEqual(4)
  })

  it('returns null for worker shelf stack (no group boundary)', () => {
    expect(
      syncZoneForNode(node(3, 'stack', 'generic', 1, 'worker')),
    ).toBeNull()
  })

  it('returns a zone for MQ parallel shards (replicas may stay 1)', () => {
    const z = syncZoneForNode(
      node(1, 'fan', 'kafka', 3, 'message-queue'),
    )
    expect(z).not.toBeNull()
    expect(z!.label).toBe('×3')
  })

  it('returns null for single-shard MQ', () => {
    expect(
      syncZoneForNode(node(1, 'stack', 'kafka', 1, 'message-queue')),
    ).toBeNull()
  })

  it('emits one obstacle anchor per unit (capped at platform max)', () => {
    expect(unitObstacleAnchors(node(1))).toHaveLength(1)
    expect(unitObstacleAnchors(node(3))).toHaveLength(3)
    expect(unitObstacleAnchors(node(9))).toHaveLength(5)
  })
})
