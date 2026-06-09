import { Container, Graphics } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { canShowConnectPreview } from '../utils/connectVisual'
import { getConnectionPoint } from '../utils/connectionPoint'
import { getIsoManhattanWaypoints, type Point2D } from '../utils/connectionRoute'

const PREVIEW_COLOR = 0x4a90d9

function drawDashedPath(
  g: Graphics,
  waypoints: Point2D[],
  stroke: { color: number; width: number; alpha: number },
  dash = 10,
  gap = 7,
): void {
  if (waypoints.length < 2) return

  let drawing = true
  let remaining = dash

  for (let seg = 0; seg < waypoints.length - 1; seg++) {
    const x0 = waypoints[seg].x
    const y0 = waypoints[seg].y
    const x1 = waypoints[seg + 1].x
    const y1 = waypoints[seg + 1].y
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len === 0) continue

    const dx = (x1 - x0) / len
    const dy = (y1 - y0) / len
    let dist = 0
    let sx = x0
    let sy = y0

    while (dist < len) {
      const step = Math.min(remaining, len - dist)
      const nx = x0 + dx * (dist + step)
      const ny = y0 + dy * (dist + step)

      if (drawing) {
        g.moveTo(sx, sy)
        g.lineTo(nx, ny)
      }

      dist += step
      sx = nx
      sy = ny
      remaining -= step
      if (remaining <= 0) {
        drawing = !drawing
        remaining = drawing ? dash : gap
      }
    }
  }

  g.stroke(stroke)
}

export class ConnectionPreview extends Container {
  private readonly line = new Graphics()
  private readonly unsubscribe: () => void

  constructor(_viewport: Viewport) {
    super()
    this.eventMode = 'none'
    this.interactiveChildren = false
    this.line.eventMode = 'none'
    this.addChild(this.line)

    let prevKey = ''
    this.unsubscribe = useCanvasStore.subscribe((state) => {
      const key = [
        state.mode,
        state.designTool,
        state.pendingSourceId ?? '',
        state.connectHoverTargetId ?? '',
        state.nodes,
      ].join('|')
      if (key === prevKey) return
      prevKey = key
      this.redraw(state)
    })

    this.redraw(useCanvasStore.getState())
  }

  private redraw(state: ReturnType<typeof useCanvasStore.getState>): void {
    this.line.clear()

    if (!canShowConnectPreview(state)) return

    const src = state.nodes[state.pendingSourceId!]
    const tgt = state.nodes[state.connectHoverTargetId!]
    if (!src || !tgt) return

    const sp = getConnectionPoint(src)
    const tp = getConnectionPoint(tgt)
    const waypoints = getIsoManhattanWaypoints(sp, tp)

    drawDashedPath(this.line, waypoints, {
      color: PREVIEW_COLOR,
      width: 1.5,
      alpha: 0.35,
    })
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unsubscribe()
    if (options) {
      super.destroy(options)
    } else {
      super.destroy({ children: true })
    }
  }
}
