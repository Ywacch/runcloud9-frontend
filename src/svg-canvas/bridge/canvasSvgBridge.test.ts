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
})
