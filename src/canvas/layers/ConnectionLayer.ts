import { Container, Graphics, Text, TextStyle, type FederatedPointerEvent } from 'pixi.js'
import { getCacheTopologyEdgeIssues } from '../../lib/cacheTopologyStrategy'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasEdge,
} from '../../editor-core/stores/canvasStore'
import { getConnectionPoint, type ConnectionPort } from '../utils/connectionPoint'
import {
  protocolBadgeFill,
  protocolLabel,
  resolveConnectionEdgeStyle,
} from '../utils/connectionEdgeStyle'
import {
  getIsoManhattanWaypoints,
  midpointAlongWaypoints,
} from '../utils/connectionRoute'
import {
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
    const topologyIssues = getCacheTopologyEdgeIssues(state.nodes, state.edges)

    for (const edge of Object.values(state.edges)) {
      const src = state.nodes[edge.sourceId]
      const tgt = state.nodes[edge.targetId]
      if (!src || !tgt) continue

      const sp = getConnectionPoint(src)
      const tp = getConnectionPoint(tgt)
      const waypoints = getIsoManhattanWaypoints(sp, tp)
      const topologyIssue = topologyIssues[edge.id]

      const edgeContainer = new Container()
      const g = new Graphics()
      this.drawEdge(
        g,
        sp,
        tp,
        waypoints,
        edge,
        eraseMode,
        state,
        topologyIssue,
      )
      edgeContainer.addChild(g)
      this.drawProtocolLabel(edgeContainer, edge, waypoints, topologyIssue)
      this.addChild(edgeContainer)
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
    waypoints: { x: number; y: number }[],
    edge: CanvasEdge,
    eraseMode: boolean,
    state: ReturnType<typeof useCanvasStore.getState>,
    topologyIssue?: string,
  ): void {
    const style = resolveConnectionEdgeStyle(
      edge.id,
      edge.sourceId,
      edge.targetId,
      edge,
      state,
      topologyIssue,
    )

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

  private drawProtocolLabel(
    parent: Container,
    edge: CanvasEdge,
    waypoints: { x: number; y: number }[],
    topologyIssue?: string,
  ): void {
    if (waypoints.length < 2) return

    const midpoint = midpointAlongWaypoints(waypoints)
    const labelContainer = new Container()
    labelContainer.eventMode = 'none'
    labelContainer.position.set(midpoint.x, midpoint.y)

    const text = new Text({
      text: `${protocolLabel(edge.protocol)}${topologyIssue ? ' !' : ''}`,
      style: new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 10,
        fill: 0xffffff,
      }),
    })
    text.anchor.set(0.5)

    const padX = 6
    const padY = 2
    const w = text.width + padX * 2
    const h = text.height + padY * 2
    const bg = new Graphics()
    bg.roundRect(-w / 2, -h / 2, w, h, 3).fill({
      color: protocolBadgeFill(topologyIssue),
    })
    bg.eventMode = 'none'

    labelContainer.addChild(bg)
    labelContainer.addChild(text)
    parent.addChild(labelContainer)
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
