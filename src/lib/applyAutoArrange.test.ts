import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { clearCanvasHistory } from './canvasHistory'
import { createCanvasNode } from './nodeFactory'
import { isoToNode } from '../canvas/utils/positionAdapter'
import * as fitBridge from '../canvas/utils/canvasFitBridge'
import { applyAutoArrange } from './applyAutoArrange'
import {
  installCanvasSvgBridge,
  resetCanvasSvgBridgeForTests,
  useSvgCanvasStore,
} from '../svg-canvas/store/svgCanvasStore'
import { canvasPositionToSvgWorld } from '../svg-canvas/bridge/canvasSvgAdapter'

describe('applyAutoArrange + SVG host lock/arrange', () => {
  beforeEach(() => {
    resetCanvasSvgBridgeForTests()
    clearCanvasHistory()
    useCanvasStore.getState().clearCanvas()
    useCanvasStore.getState().setMode('design')
    useCanvasStore.getState().setDeploymentId(null)
    useCanvasStore.getState().setMovementLocked(false)
  })

  it('writes arranged canvas positions through to the SVG store', () => {
    const a = createCanvasNode('compute', isoToNode(0, 0), {})
    const b = createCanvasNode('database', isoToNode(0, 0), {})
    a.id = 'a'
    b.id = 'b'
    useCanvasStore.getState().addNode(a)
    useCanvasStore.getState().addNode(b)
    useCanvasStore.getState().addEdge({
      id: 'e1',
      sourceId: a.id,
      targetId: b.id,
      protocol: 'sql',
      animated: false,
    })
    installCanvasSvgBridge()

    const fit = vi.spyOn(fitBridge, 'requestCanvasFit')
    expect(applyAutoArrange()).toBe(true)
    expect(fit).toHaveBeenCalled()

    const canvas = useCanvasStore.getState().nodes
    // Dependency layers: compute layer 0, database layer 1 → NE via -z.
    expect(canvas[a.id].position[2]).toBeGreaterThan(canvas[b.id].position[2])

    const svg = useSvgCanvasStore.getState().nodes
    const svgA = svg.find((n) => n.id === a.id)!
    const svgB = svg.find((n) => n.id === b.id)!
    const worldA = canvasPositionToSvgWorld(canvas[a.id].position)
    const worldB = canvasPositionToSvgWorld(canvas[b.id].position)
    expect(svgA.x).toBeCloseTo(worldA.x, 5)
    expect(svgA.y).toBeCloseTo(worldA.y, 5)
    expect(svgB.x).toBeCloseTo(worldB.x, 5)
    expect(svgB.y).toBeCloseTo(worldB.y, 5)
  })

  it('blocks SVG moveNodes and placeNodeAt when movement is locked', () => {
    const node = createCanvasNode('compute', isoToNode(0, 0), {})
    useCanvasStore.getState().addNode(node)
    installCanvasSvgBridge()
    const before = useSvgCanvasStore.getState().nodes[0]

    useCanvasStore.getState().setMovementLocked(true)
    useSvgCanvasStore.getState().moveNodes([
      { id: node.id, x: before.x + 200, y: before.y + 100 },
    ])
    expect(useSvgCanvasStore.getState().nodes[0].x).toBe(before.x)
    expect(useSvgCanvasStore.getState().nodes[0].y).toBe(before.y)

    useCanvasStore.getState().setPlacingNodeType('cache')
    useSvgCanvasStore.getState().placeNodeAt(400, 200)
    expect(Object.keys(useCanvasStore.getState().nodes)).toHaveLength(1)
  })

  it('returns false when the canvas is empty', () => {
    expect(applyAutoArrange()).toBe(false)
  })
})
