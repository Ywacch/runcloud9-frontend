import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { createCanvasNode } from '../../lib/nodeFactory'
import { clearCanvasHistory } from '../../lib/canvasHistory'
import { isoToNode } from '../../canvas/utils/positionAdapter'
import {
  installCanvasSvgBridge,
  resetCanvasSvgBridgeForTests,
  useSvgCanvasStore,
} from '../store/svgCanvasStore'

describe('canvasSvgBridge', () => {
  beforeEach(() => {
    resetCanvasSvgBridgeForTests()
    clearCanvasHistory()
    useCanvasStore.getState().clearCanvas()
    useCanvasStore.getState().setMode('design')
    useCanvasStore.getState().setDeploymentId(null)
  })

  it('projects canvasStore nodes into the SVG store after install', () => {
    const node = createCanvasNode('database', isoToNode(1, 1), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    const svgNodes = useSvgCanvasStore.getState().nodes
    expect(svgNodes).toHaveLength(1)
    expect(svgNodes[0].id).toBe(node.id)
    expect(svgNodes[0].archetype).toBe('database')
    expect(svgNodes[0].engine).toBe('postgresql')
  })

  it('writes SVG placeNodeAt into canvasStore', () => {
    installCanvasSvgBridge()
    useCanvasStore.getState().clearCanvas()
    useSvgCanvasStore.getState().setPlacingArchetype('cache')
    useSvgCanvasStore.getState().placeNodeAt(0, 0)
    const canvasNodes = Object.values(useCanvasStore.getState().nodes)
    expect(canvasNodes).toHaveLength(1)
    expect(canvasNodes[0].type).toBe('cache')
    expect(useSvgCanvasStore.getState().nodes[0].archetype).toBe('cache')
  })

  it('syncs replica edits through config.replicas', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useSvgCanvasStore.getState().setNodeReplicas(node.id, 3)
    expect(useCanvasStore.getState().nodes[node.id].config.replicas).toBe(3)
    expect(
      useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
        ?.topology.replicas,
    ).toBe(3)
  })

  it('shares selection with canvasStore', () => {
    const node = createCanvasNode('worker', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useSvgCanvasStore.getState().selectOnly(node.id)
    expect(useCanvasStore.getState().selectedId).toBe(node.id)
    expect(useCanvasStore.getState().selectedIds).toEqual([node.id])
  })

  it('preserves healthVisual across canvas sync', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    useSvgCanvasStore.getState().setNodeHealthVisual([node.id], 'warning')
    useCanvasStore.getState().updateNodeLabel(node.id, 'Renamed')
    const svg = useSvgCanvasStore.getState().nodes.find((n) => n.id === node.id)
    expect(svg?.healthVisual).toBe('warning')
    expect(svg?.label).toBe('Renamed')
  })

  it('projects CanvasEdge.animated as trafficEnabled', () => {
    const a = createCanvasNode('compute', isoToNode(0, 0), {})
    const b = createCanvasNode('database', isoToNode(2, 0), {})
    useCanvasStore.getState().addNode(a)
    useCanvasStore.getState().addNode(b)
    const edge = {
      id: crypto.randomUUID(),
      sourceId: a.id,
      targetId: b.id,
      protocol: 'http' as const,
      animated: true,
    }
    useCanvasStore.getState().addEdge(edge)
    installCanvasSvgBridge()
    const svgEdge = useSvgCanvasStore.getState().edges.find((e) => e.id === edge.id)
    expect(svgEdge?.trafficEnabled).toBe(true)
  })

  it('projects CanvasEdge.protocol onto SvgEdge', () => {
    const a = createCanvasNode('compute', isoToNode(0, 0), {})
    const b = createCanvasNode('cache', isoToNode(2, 0), {})
    useCanvasStore.getState().addNode(a)
    useCanvasStore.getState().addNode(b)
    const edge = {
      id: crypto.randomUUID(),
      sourceId: a.id,
      targetId: b.id,
      protocol: 'tcp' as const,
      animated: false,
    }
    useCanvasStore.getState().addEdge(edge)
    installCanvasSvgBridge()
    const svgEdge = useSvgCanvasStore.getState().edges.find((e) => e.id === edge.id)
    expect(svgEdge?.protocol).toBe('tcp')
  })
})
