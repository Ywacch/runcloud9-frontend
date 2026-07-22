import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { findTopologyViolations } from './topologyGuard'
import { topologyLimitsForTier } from './userTier'

function cacheNode(strategy: string): CanvasNode {
  return {
    id: 'cache-1',
    type: 'cache',
    label: 'Redis',
    position: [0, 0, 0],
    config: { cacheStrategy: strategy },
    status: 'idle',
  }
}

describe('findTopologyViolations', () => {
  const freeLimits = topologyLimitsForTier('free')

  it('flags proxy cache strategy on free tier', () => {
    const violations = findTopologyViolations(
      { 'cache-1': cacheNode('write-through') },
      freeLimits,
    )
    expect(violations.some((v) => v.kind === 'proxy_cache')).toBe(true)
    expect(violations.find((v) => v.kind === 'proxy_cache')?.message).toBe(
      'That cache strategy needs Engineer. Use cache-aside or timeline-store, or upgrade.',
    )
  })

  it('allows cache-aside on free tier', () => {
    const violations = findTopologyViolations(
      { 'cache-1': cacheNode('cache-aside') },
      freeLimits,
    )
    expect(violations).toHaveLength(0)
  })

  it('reads strategy from config.strategy fallback', () => {
    const node: CanvasNode = {
      ...cacheNode('cache-aside'),
      config: { strategy: 'read-through' },
    }
    const violations = findTopologyViolations({ 'cache-1': node }, freeLimits)
    expect(violations.some((v) => v.kind === 'proxy_cache')).toBe(true)
  })

  it('flags load balancer with plain upgrade copy', () => {
    const node: CanvasNode = {
      id: 'lb-1',
      type: 'load_balancer',
      label: 'LB',
      position: [0, 0, 0],
      config: {},
      status: 'idle',
    }
    const violations = findTopologyViolations({ 'lb-1': node }, freeLimits)
    expect(violations[0]?.message).toBe(
      'Load balancers need Engineer. Remove them or upgrade.',
    )
  })
})
