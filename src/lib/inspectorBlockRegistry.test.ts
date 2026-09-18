import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  DB_INSPECTOR_BLOCKS,
  groupInspectorBlocksByLayer,
  visibleInspectorBlocks,
} from './inspectorBlockRegistry'
import { inspectorCapabilities } from './inspectorCapabilities'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { reduceSessionFacts } from './sessionFacts'

function dbNode(config: Record<string, unknown> = {}): CanvasNode {
  return {
    id: 'db-1',
    type: 'database',
    position: [0, 0, 0],
    label: 'db',
    status: 'healthy',
    config,
  }
}

const emptyBucket = {} as MetricsBucket

describe('inspectorBlockRegistry', () => {
  it('hides replica lag blocks at zero readReplicas', () => {
    const nodes = { 'db-1': dbNode({ readReplicas: 0 }) }
    const cap = inspectorCapabilities(nodes, nodes['db-1'], { loadgenActive: true })
    const visible = visibleInspectorBlocks(DB_INSPECTOR_BLOCKS, cap, {})
    expect(visible.some((b) => b.id === 'db.replica-lag')).toBe(false)
    expect(visible.some((b) => b.id === 'db.activity')).toBe(true)
  })

  it('promotes failover into tradeoff layer grouping', () => {
    const nodes = { 'db-1': dbNode({ readReplicas: 2 }) }
    const cap = inspectorCapabilities(nodes, nodes['db-1'], { loadgenActive: true })
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
    const grouped = groupInspectorBlocksByLayer(
      DB_INSPECTOR_BLOCKS,
      cap,
      emptyBucket,
      facts,
    )
    expect(grouped.tradeoff.some((b) => b.id === 'db.after-failover')).toBe(true)
  })
})
