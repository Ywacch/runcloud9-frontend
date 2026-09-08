import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode, CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import { autoArrangeByDependencyLayers } from '../../lib/autoArrange'
import { createCanvasNode } from '../../lib/nodeFactory'
import { isoToNode } from '../../canvas/utils/positionAdapter'
import { canvasNodeToSvgNode } from './canvasSvgAdapter'
import { projectedSceneFromSnapshot, previewWorldPoints } from './isoPreviewScene'
import { routeConnectorScene, is8AxisSegment } from '../routing/connectorSegments'
import { connectorStrokeForProtocol } from '../fx/connectorStroke'
import { topologyPreviewViewBox } from '../export/exportViewBox'

describe('iso preview scene', () => {
  it('projects social-feed async fan-out with 8-axis routes and protocol strokes', () => {
    const specs: [string, CanvasNode['type']][] = [
      ['app', 'compute'],
      ['cache', 'cache'],
      ['mq', 'message_queue'],
      ['worker', 'worker'],
      ['db', 'database'],
    ]
    const nodes: CanvasNode[] = specs.map(([id, kind]) => {
      const n = createCanvasNode(kind, isoToNode(0, 0), {})
      n.id = id
      return n
    })
    const edges: CanvasEdge[] = [
      ['e1', 'app', 'cache', 'http'],
      ['e2', 'app', 'mq', 'http'],
      ['e3', 'mq', 'worker', 'tcp'],
      ['e4', 'worker', 'cache', 'http'],
      ['e5', 'worker', 'db', 'http'],
    ].map(([id, sourceId, targetId, protocol]) => ({
      id,
      sourceId,
      targetId,
      protocol: protocol as CanvasEdge['protocol'],
      animated: false,
    }))
    const arranged = autoArrangeByDependencyLayers(nodes, edges)
    const snapshot: CanvasSnapshot = {
      version: '1.0',
      templateId: 'social-feed',
      nodes: nodes.map((n) => ({
        ...n,
        position: arranged[n.id] ?? n.position,
      })),
      edges,
      exportedAt: new Date().toISOString(),
    }
    const scene = projectedSceneFromSnapshot(snapshot)
    expect(scene.nodes.length).toBe(5)
    expect(scene.edges.length).toBe(5)

    for (const edge of scene.edges) {
      expect(edge.waypoints.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < edge.waypoints.length; i++) {
        expect(is8AxisSegment(edge.waypoints[i - 1], edge.waypoints[i])).toBe(true)
      }
      const stroke = connectorStrokeForProtocol(edge.protocol, 'flow', 'dark')
      expect(stroke).not.toBeNull()
      if (edge.protocol === 'tcp') {
        expect(stroke?.dash).toBeTruthy()
        expect(stroke?.color).toBe('#ff5722')
      } else {
        expect(stroke?.dash).toBeUndefined()
        expect(stroke?.color).toBe('#4286c5')
      }
    }

    const vb = topologyPreviewViewBox(previewWorldPoints(scene))
    expect(vb.w / vb.h).toBeCloseTo(2.5, 5)

    const svgNodes = snapshot.nodes.map((n) =>
      canvasNodeToSvgNode(n),
    )
    const routes = routeConnectorScene({
      nodes: svgNodes,
      zones: [],
      edges: edges.map((e) => ({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
      })),
    })
    expect(routes.get('e3')?.length).toBeGreaterThanOrEqual(2)
  })
})
