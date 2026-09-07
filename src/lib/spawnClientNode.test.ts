import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { isoToNode } from '../canvas/utils/positionAdapter'
import * as fitBridge from '../canvas/utils/canvasFitBridge'
import { createCanvasNode } from './nodeFactory'
import { CLIENT_LOADGEN_ID, spawnClientLoadgenNode } from './spawnClientNode'

describe('spawnClientLoadgenNode', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas()
    useCanvasStore.getState().setMode('design')
  })

  it('arranges the canvas after inserting traffic source', () => {
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    const db = createCanvasNode('database', isoToNode(4, 0), {})
    app.id = 'app'
    db.id = 'db'
    useCanvasStore.getState().addNode(app)
    useCanvasStore.getState().addNode(db)
    useCanvasStore.getState().addEdge({
      id: 'app-db',
      sourceId: app.id,
      targetId: db.id,
      protocol: 'tcp',
      animated: false,
    })

    const fit = vi.spyOn(fitBridge, 'requestCanvasFit')
    spawnClientLoadgenNode()

    const nodes = useCanvasStore.getState().nodes
    expect(nodes[CLIENT_LOADGEN_ID]).toBeTruthy()
    expect(fit).toHaveBeenCalled()
    expect(nodes[CLIENT_LOADGEN_ID].position[2]).toBeGreaterThan(
      nodes[app.id].position[2],
    )
    expect(nodes[app.id].position[2]).toBeGreaterThan(nodes[db.id].position[2])
  })

  it('does not duplicate the traffic source', () => {
    const app = createCanvasNode('compute', isoToNode(0, 0), {})
    app.id = 'app'
    useCanvasStore.getState().addNode(app)
    spawnClientLoadgenNode()
    spawnClientLoadgenNode()
    expect(
      Object.values(useCanvasStore.getState().nodes).filter(
        (n) => n.type === 'client',
      ),
    ).toHaveLength(1)
  })
})
