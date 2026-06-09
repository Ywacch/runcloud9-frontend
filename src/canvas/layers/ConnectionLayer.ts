import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { getConnectionPoint, type ConnectionPort } from '../utils/connectionPoint'
import { getIsoManhattanWaypoints } from '../utils/connectionRoute'
import {
  walkthroughEdgeStyle,
  walkthroughStoreKey,
} from '../utils/walkthroughVisual'

export class ConnectionLayer extends Container {
  private readonly unsubscribe: () => void

  constructor() {
    super()

    let prev = {
      edges: useCanvasStore.getState().edges,
      nodes: useCanvasStore.getState().nodes,
      designTool: useCanvasStore.getState().designTool,
      mode: useCanvasStore.getState().mode,
      walkthroughKey: walkthroughStoreKey(useCanvasStore.getState()),
    }

    this.unsubscribe = useCanvasStore.subscribe((state) => {
      const walkthroughKey = walkthroughStoreKey(state)
      if (
        state.edges !== prev.edges ||
        state.nodes !== prev.nodes ||
        state.designTool !== prev.designTool ||
        state.mode !== prev.mode ||
        walkthroughKey !== prev.walkthroughKey
      ) {
        prev = {
          edges: state.edges,
          nodes: state.nodes,
          designTool: state.designTool,
          mode: state.mode,
          walkthroughKey,
        }
        this.redraw(state)
      }
    })

    this.redraw(useCanvasStore.getState())
  }

  private redraw(state: ReturnType<typeof useCanvasStore.getState>): void {
    this.removeChildren()

    const eraseMode =
      isCanvasEditMode(state.mode) && state.designTool === 'erase'

    for (const edge of Object.values(state.edges)) {
      const src = state.nodes[edge.sourceId]
      const tgt = state.nodes[edge.targetId]
      if (!src || !tgt) continue

      const sp = getConnectionPoint(src)
      const tp = getConnectionPoint(tgt)
      const g = new Graphics()
      this.drawEdge(g, sp, tp, edge, eraseMode, state)
      this.addChild(g)
    }
  }

  private drawPath(
    g: Graphics,
    waypoints: { x: number; y: number }[],
    stroke: { color: number; alpha: number; width: number },
  ): void {
    if (waypoints.length < 2) return
    g.moveTo(waypoints[0].x, waypoints[0].y)
    for (let i = 1; i < waypoints.length; i++) {
      g.lineTo(waypoints[i].x, waypoints[i].y)
    }
    g.stroke(stroke)
  }

  private drawEdge(
    g: Graphics,
    sp: ConnectionPort,
    tp: ConnectionPort,
    edge: CanvasEdge,
    eraseMode: boolean,
    state: ReturnType<typeof useCanvasStore.getState>,
  ): void {
    const style = walkthroughEdgeStyle(edge.id, edge.sourceId, edge.targetId, edge, state)
    const waypoints = getIsoManhattanWaypoints(sp, tp)

    g.circle(sp.x, sp.y, 3).fill({ color: style.color, alpha: Math.min(style.alpha + 0.2, 1) })
    g.circle(tp.x, tp.y, 3).fill({ color: style.color, alpha: Math.min(style.alpha + 0.2, 1) })

    this.drawPath(g, waypoints, {
      color: style.color,
      alpha: style.alpha,
      width: style.width,
    })

    if (waypoints.length >= 2) {
      const p1 = waypoints[waypoints.length - 2]
      const p2 = waypoints[waypoints.length - 1]
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      const len = 8
      const spread = Math.PI / 6
      g.poly([
        p2.x,
        p2.y,
        p2.x - len * Math.cos(angle - spread),
        p2.y - len * Math.sin(angle - spread),
        p2.x - len * Math.cos(angle + spread),
        p2.y - len * Math.sin(angle + spread),
      ])
      g.fill({ color: style.color, alpha: Math.min(style.alpha + 0.15, 1) })
    }

    if (eraseMode) {
      this.drawPath(g, waypoints, { width: 14, alpha: 0.001, color: 0xffffff })
      g.eventMode = 'static'
      g.cursor = 'pointer'
      g.on('pointerdown', (e: FederatedPointerEvent) => {
        e.stopPropagation()
        if (useCanvasStore.getState().designTool !== 'erase') return
        useCanvasStore.getState().removeEdge(edge.id)
      })
    } else {
      g.eventMode = 'none'
    }
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
