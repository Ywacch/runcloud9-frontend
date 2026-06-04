import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { getConnectionPoint } from '../utils/connectionPoint'

export class ConnectionPreview extends Container {
  private readonly line = new Graphics()
  private readonly unsubscribe: () => void
  private readonly viewport: Viewport

  constructor(viewport: Viewport) {
    super()
    // Above nodes for visibility but must not intercept clicks to complete a connection.
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

    this.line.clear()
    this.line.moveTo(sp.x, sp.y)
    this.line.lineTo(world.x, world.y)
    this.line.stroke({ color: 0x9b8cff, width: 1.5, alpha: 0.5 })
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
