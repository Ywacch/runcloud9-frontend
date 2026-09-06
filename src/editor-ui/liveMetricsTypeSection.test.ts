import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { LiveMetricsTypeSection } from './liveMetricsTypeSection'

vi.mock('../editor-core/playback/useTweenedMetric', () => ({
  useTweenedMetric: () => null,
}))

vi.mock('../editor-core/stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setSelectedInstanceId: vi.fn(),
      deploymentId: null,
    }),
}))

function mqMetrics(): MetricsBucket {
  return {
    produceRate: 1,
    consumeRate: 1,
    queueDepth: 3,
    messagesReady: 2,
    messagesUnacked: 1,
    mqMemoryUsed: 0,
    mqMemoryLimit: 0,
    podReplicas: [],
  } as unknown as MetricsBucket
}

describe('LiveMetricsTypeSection message_queue', () => {
  it('points users at Data tab Peek for message bodies', () => {
    const node: CanvasNode = {
      id: 'mq-1',
      type: 'message_queue',
      position: [0, 0, 0],
      label: 'Queue',
      config: {},
      status: 'healthy',
    }

    const html = renderToStaticMarkup(
      createElement(LiveMetricsTypeSection, {
        node,
        m: mqMetrics(),
        mode: 'live',
        history: [],
        edges: {},
        nodes: { 'mq-1': node },
        snapshotTemplateId: 'social-feed',
        templateMetrics: {},
        loadgenActive: false,
        view: { timeframe: 'live', showGraphs: false, latencyQuantile: 'p95' },
      }),
    )

    expect(html).toContain(
      'Message bodies: Data tab → Peek (requeues the head message).',
    )
  })
})
