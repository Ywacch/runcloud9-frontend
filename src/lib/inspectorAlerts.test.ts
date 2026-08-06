import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { idleClientLoadgenBucket } from './clientMetrics'
import {
  ALERT_CACHE_HIT_PCT,
  ALERT_ERROR_RATE_PER_SEC,
  ALERT_QUEUE_DEPTH_MIN,
  ALERT_RESOURCE_PCT,
  evaluateInspectorAlerts,
  mergeAlertCandidates,
} from './inspectorAlerts'

function node(
  partial: Partial<CanvasNode> & Pick<CanvasNode, 'id' | 'type'>,
): CanvasNode {
  return {
    position: [0, 0, 0],
    label: partial.label ?? partial.type,
    config: {},
    status: 'healthy',
    ...partial,
  }
}

function bucket(patch: Partial<MetricsBucket>): MetricsBucket {
  return {
    ...idleClientLoadgenBucket(),
    cpuIsEstimated: false,
    memIsEstimated: false,
    ...patch,
  }
}

describe('evaluateInspectorAlerts', () => {
  it('fires CPU and memory approaching-limit alerts', () => {
    const nodes = {
      app: node({ id: 'app', type: 'compute', label: 'App Server' }),
    }
    const metrics = {
      app: bucket({
        cpuPercent: ALERT_RESOURCE_PCT,
        memPercent: 96,
      }),
    }
    const alerts = evaluateInspectorAlerts(nodes, metrics)
    expect(alerts.map((a) => a.kind).sort()).toEqual(['cpu', 'memory'])
    expect(alerts.find((a) => a.kind === 'cpu')?.title).toContain(
      'CPU approaching limit',
    )
    expect(alerts.find((a) => a.kind === 'memory')?.severity).toBe('critical')
  })

  it('skips estimated resource readings', () => {
    const nodes = { app: node({ id: 'app', type: 'compute' }) }
    const metrics = {
      app: bucket({
        cpuPercent: 99,
        memPercent: 99,
        cpuIsEstimated: true,
        memIsEstimated: true,
      }),
    }
    expect(evaluateInspectorAlerts(nodes, metrics)).toEqual([])
  })

  it('fires cache hit-rate drop when there is traffic', () => {
    const nodes = { cache: node({ id: 'cache', type: 'cache', label: 'Redis' }) }
    const metrics = {
      cache: bucket({
        cacheHits: 20,
        cacheMisses: 80,
      }),
    }
    const alerts = evaluateInspectorAlerts(nodes, metrics)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('cache_hit')
    expect(alerts[0].title).toContain(`${ALERT_CACHE_HIT_PCT - 30}`)
  })

  it('fires queue backlog and error-rate spike', () => {
    const nodes = {
      mq: node({ id: 'mq', type: 'message_queue', label: 'Message queue' }),
      app: node({ id: 'app', type: 'compute', label: 'App Server' }),
    }
    const metrics = {
      mq: bucket({
        queueDepth: ALERT_QUEUE_DEPTH_MIN,
        produceRate: 40,
        consumeRate: 10,
      }),
      app: bucket({ errorRate: ALERT_ERROR_RATE_PER_SEC }),
    }
    const kinds = evaluateInspectorAlerts(nodes, metrics)
      .map((a) => a.kind)
      .sort()
    expect(kinds).toEqual(['error_rate', 'queue_backlog'])
  })
})

describe('mergeAlertCandidates', () => {
  it('respects cooldown and max visible', () => {
    const candidates = [
      {
        id: 'a:cpu',
        nodeId: 'a',
        kind: 'cpu' as const,
        severity: 'warning' as const,
        title: 't1',
        body: 'b1',
      },
      {
        id: 'b:cpu',
        nodeId: 'b',
        kind: 'cpu' as const,
        severity: 'warning' as const,
        title: 't2',
        body: 'b2',
      },
      {
        id: 'c:cpu',
        nodeId: 'c',
        kind: 'cpu' as const,
        severity: 'warning' as const,
        title: 't3',
        body: 'b3',
      },
      {
        id: 'd:cpu',
        nodeId: 'd',
        kind: 'cpu' as const,
        severity: 'warning' as const,
        title: 't4',
        body: 'b4',
      },
    ]
    const merged = mergeAlertCandidates({
      candidates,
      activeIds: [],
      cooldownUntil: { 'a:cpu': Date.now() + 60_000 },
      now: Date.now(),
      maxVisible: 2,
    })
    expect(merged.map((c) => c.id)).toEqual(['b:cpu', 'c:cpu'])
  })
})
