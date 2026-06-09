import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { connectionPortAt, getConnectionPoint } from '../utils/connectionPoint'
import { getIsoManhattanWaypoints } from '../utils/connectionRoute'

export class ConnectionPreview extends Container {
  private readonly line = new Graphics()
  private readonly unsubscribe: () => void
  private readonly viewport: Viewport

  constructor(viewport: Viewport) {
    super()
    this.eventMode = 'none'
    this.interactiveChildren = false
    this.viewport = viewport
    this.line.eventMode = 'none'
    this.addChild(this.line)

    let prevId = useCanvasStore.getState().pendingSourceId
    this.unsubscribe = useCanvasStore.subscribe((state) => {
      if (state.pendingSourceId !== prevId) {
        prevId = state.pendingSourceId
        if (!state.pendingSourceId) this.line.clear()
      }
    })

    viewport.on('pointermove', this.onMove, this)
  }

  private onMove = (e: FederatedPointerEvent): void => {
    const { pendingSourceId, nodes } = useCanvasStore.getState()
    if (!pendingSourceId) return

    const src = nodes[pendingSourceId]
    if (!src) return

    const sp = getConnectionPoint(src)
    const world = this.viewport.toWorld(e.global.x, e.global.y)
    const tp = connectionPortAt(world.x, world.y, world.y)
    const waypoints = getIsoManhattanWaypoints(sp, tp)

    this.line.clear()
    this.line.circle(sp.x, sp.y, 3).fill({ color: 0x8892b0, alpha: 1 })
    if (waypoints.length >= 2) {
      this.line.moveTo(waypoints[0].x, waypoints[0].y)
      for (let i = 1; i < waypoints.length; i++) {
        this.line.lineTo(waypoints[i].x, waypoints[i].y)
      }
      this.line.stroke({ color: 0x8892b0, width: 1.5, alpha: 0.7 })
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unsubscribe()
    this.viewport.off('pointermove', this.onMove, this)
    if (options) {
      super.destroy(options)
    } else {
      super.destroy({ children: true })
    }
  }
}
