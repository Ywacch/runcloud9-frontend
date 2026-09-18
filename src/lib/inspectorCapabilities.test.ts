import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  inspectorCapabilities,
  showCacheEngineCommandsInNow,
  showCacheVsDatabase,
  showDbConsistencyTradeoff,
  showDbReplicaLag,
  showLbPerBackendDistribution,
  showLbSingleBackendNudge,
  showLegacyRedisOpsRow,
} from './inspectorCapabilities'
import { reduceSessionFacts } from './sessionFacts'

function node(type: CanvasNode['type'], config: Record<string, unknown> = {}): CanvasNode {
  return {
    id: `${type}-1`,
    type,
    position: [0, 0, 0],
    label: type,
    status: 'healthy',
    config,
  }
}

describe('inspectorCapabilities', () => {
  it('reads readReplicas from the database node config, not metrics payload', () => {
    const nodes = {
      'db-1': node('database', { readReplicas: 0 }),
      'cache-1': node('cache'),
    }
    const cap = inspectorCapabilities(nodes, nodes['db-1'], { loadgenActive: true })
    expect(cap.readReplicas).toBe(0)
    expect(cap.hasCache).toBe(true)
    expect(showDbReplicaLag(cap)).toBe(false)
  })

  it('hides cache-vs-database when no cache node exists', () => {
    const nodes = { 'db-1': node('database', { readReplicas: 1 }) }
    const cap = inspectorCapabilities(nodes, nodes['db-1'], { loadgenActive: false })
    expect(showCacheVsDatabase(cap)).toBe(false)
  })

  it('shows consistency tradeoff only for leader-only with zero replicas and no facts', () => {
    const nodes = { 'db-1': node('database', { readReplicas: 0 }) }
    const cap = inspectorCapabilities(nodes, nodes['db-1'], { loadgenActive: false })
    expect(showDbConsistencyTradeoff(cap, {})).toBe(false)
  })

  it('hides legacy redis ops when storageIo is present', () => {
    const nodes = { 'cache-1': node('cache') }
    const cap = inspectorCapabilities(nodes, nodes['cache-1'], { loadgenActive: true })
    expect(
      showLegacyRedisOpsRow(
        cap,
        { storageIo: { readRate: 50 }, redisOpsPerSec: 100 },
        true,
      ),
    ).toBe(false)
  })

  it('shows lb single-backend nudge only with one backend', () => {
    const nodes = { 'lb-1': node('load_balancer') }
    const cap = inspectorCapabilities(nodes, nodes['lb-1'], { loadgenActive: true })
    expect(showLbPerBackendDistribution(1)).toBe(false)
    expect(showLbSingleBackendNudge(cap, 1)).toBe(true)
    expect(showLbSingleBackendNudge(cap, 2)).toBe(false)
  })

  it('promotes cache engine commands on timeline without app hit/miss', () => {
    const nodes = { 'cache-1': node('cache') }
    const cap = inspectorCapabilities(nodes, nodes['cache-1'], { loadgenActive: true })
    expect(showCacheEngineCommandsInNow(cap, false, true)).toBe(true)
    expect(showCacheEngineCommandsInNow(cap, true, true)).toBe(false)
  })

  it('shows consistency tradeoff after failover even at zero replicas', () => {
    const nodes = { 'db-1': node('database', { readReplicas: 0 }) }
    const cap = inspectorCapabilities(nodes, nodes['db-1'], { loadgenActive: false })
    const facts = reduceSessionFacts([
      {
        timestamp: '2026-01-01T00:00:00Z',
        type: 'action',
        source: 'chaos',
        kind: 'chaos_inject',
        component: 'db',
        title: 'Promote',
        description: 'promote_replica',
        detail: { scenario: 'promote_replica', walBytesLost: '0' },
      },
    ])
    expect(showDbConsistencyTradeoff(cap, facts)).toBe(true)
  })
})
