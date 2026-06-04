import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { getConnectionPoint } from '../utils/connectionPoint'

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

  private drawEdge(
    g: Graphics,
    sp: { x: number; y: number },
    tp: { x: number; y: number },
    edge: CanvasEdge,
    eraseMode: boolean,
  ): void {
    const color = edge.animated ? 0x9b8cff : 0x6366f1
    const alpha = edge.animated ? 0.85 : 0.45
    const width = edge.animated ? 2 : 1.5

    g.moveTo(sp.x, sp.y)
    g.lineTo(tp.x, tp.y)
    g.stroke({ color, alpha, width })

    const angle = Math.atan2(tp.y - sp.y, tp.x - sp.x)
    const len = 10
    const spread = Math.PI / 6

    g.poly([
      tp.x,
      tp.y,
      tp.x - len * Math.cos(angle - spread),
      tp.y - len * Math.sin(angle - spread),
      tp.x - len * Math.cos(angle + spread),
      tp.y - len * Math.sin(angle + spread),
    ])
    g.fill({ color, alpha: Math.min(alpha + 0.15, 1) })

    if (eraseMode) {
      g.moveTo(sp.x, sp.y)
      g.lineTo(tp.x, tp.y)
      g.stroke({ width: 14, alpha: 0.001, color: 0xffffff })
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
