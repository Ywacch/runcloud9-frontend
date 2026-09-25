import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  metricGroupsForNode,
  panelViewVisibilityForGroup,
  resolveMetricGroupId,
} from './inspectorMetricGroups'

function node(type: CanvasNode['type'], config: Record<string, unknown> = {}): CanvasNode {
  return {
    id: 'n1',
    type,
    label: 'n1',
    position: [0, 0, 0],
    status: 'idle',
    config,
  }
}

describe('inspectorMetricGroups', () => {
  it('hides replicas group when only one pod', () => {
    const groups = metricGroupsForNode(node('compute'), {
      podReplicas: [{ name: 'a', requestRate: 1, p99Latency: 0, cpuPercent: 1, memPercent: 1 }],
    } as never)
    expect(groups.map((g) => g.id)).toEqual(['health', 'internals'])
  })

  it('hides replication when readReplicas is 0', () => {
    const groups = metricGroupsForNode(node('database', { readReplicas: 0 }))
    expect(groups.map((g) => g.id)).not.toContain('replication')
  })

  it('falls back when stored group is hidden', () => {
    const id = resolveMetricGroupId(
      node('compute'),
      'replicas',
      { podReplicas: [] } as never,
    )
    expect(id).toBe('health')
  })

  it('replication group hides timeframe and graphs toggles', () => {
    expect(panelViewVisibilityForGroup('replication')).toEqual({
      showGraphs: false,
      showLatency: false,
      showTimeframe: false,
    })
  })

  it('message queue flow and backlog hide session toggle (rates only)', () => {
    expect(panelViewVisibilityForGroup('flow').showTimeframe).toBe(false)
    expect(panelViewVisibilityForGroup('backlog').showTimeframe).toBe(false)
  })
})
