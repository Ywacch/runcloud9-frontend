import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { getConnectionPoint, type ConnectionPort } from '../utils/connectionPoint'
import { getIsoManhattanWaypoints } from '../utils/connectionRoute'

export class ConnectionLayer extends Container {
  private readonly unsubscribe: () => void

  constructor() {
    super()

    let prev = {
      edges: useCanvasStore.getState().edges,
      nodes: useCanvasStore.getState().nodes,
      designTool: useCanvasStore.getState().designTool,
      mode: useCanvasStore.getState().mode,
    }

    this.unsubscribe = useCanvasStore.subscribe((state) => {
      if (
        state.edges !== prev.edges ||
        state.nodes !== prev.nodes ||
        state.designTool !== prev.designTool ||
        state.mode !== prev.mode
      ) {
        prev = {
          edges: state.edges,
          nodes: state.nodes,
          designTool: state.designTool,
          mode: state.mode,
        }
        this.redraw(state.nodes, state.edges, state.designTool)
      }
    })

    const initial = useCanvasStore.getState()
    this.redraw(initial.nodes, initial.edges, initial.designTool)
  }

  private redraw(
    nodes: Record<string, CanvasNode>,
    edges: Record<string, CanvasEdge>,
    designTool: ReturnType<typeof useCanvasStore.getState>['designTool'],
  ): void {
    this.removeChildren()

    const eraseMode =
      isCanvasEditMode(useCanvasStore.getState().mode) && designTool === 'erase'

    for (const edge of Object.values(edges)) {
      const src = nodes[edge.sourceId]
      const tgt = nodes[edge.targetId]
      if (!src || !tgt) continue

      const sp = getConnectionPoint(src)
      const tp = getConnectionPoint(tgt)
      const g = new Graphics()
      this.drawEdge(g, sp, tp, edge, eraseMode)
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
  ): void {
    const color = edge.animated ? 0x00aeef : 0x8892b0
    const alpha = edge.animated ? 1.0 : 0.7
    const width = edge.animated ? 2 : 1.5

    const waypoints = getIsoManhattanWaypoints(sp, tp)

    this.drawPath(g, waypoints, { color, alpha, width })

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
      g.fill({ color, alpha: 1 })
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
