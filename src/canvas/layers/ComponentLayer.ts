import { Container } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { ComponentContainer } from '../components/ComponentContainer'
import { requestCanvasFit } from '../utils/canvasFitBridge'
import { useCanvasStore, type CanvasNode } from '../../editor-core/stores/canvasStore'
import {
  walkthroughNodeRole,
  walkthroughStoreKey,
} from '../utils/walkthroughVisual'

export class ComponentLayer extends Container {
  private readonly viewport: Viewport
  private readonly containers = new Map<string, ComponentContainer>()
  private readonly unsubscribe: () => void

  constructor(viewport: Viewport) {
    super()
    this.viewport = viewport
    this.sortableChildren = true

    const initialNodes = useCanvasStore.getState().nodes
    this._syncNodes(initialNodes)
    this._syncSelection(useCanvasStore.getState().selectedId)

    let prevNodes = initialNodes
    let prevSelectedId = useCanvasStore.getState().selectedId
    let prevWalkthroughKey = walkthroughStoreKey(useCanvasStore.getState())
    this._syncWalkthrough(useCanvasStore.getState())

    this.unsubscribe = useCanvasStore.subscribe((state) => {
      if (state.nodes !== prevNodes) {
        prevNodes = state.nodes
        this._syncNodes(state.nodes)
        this._syncWalkthrough(state)
      }
      if (state.selectedId !== prevSelectedId) {
        const oldId = prevSelectedId
        prevSelectedId = state.selectedId
        this._syncSelection(state.selectedId, oldId)
      }
      const wtKey = walkthroughStoreKey(state)
      if (wtKey !== prevWalkthroughKey) {
        prevWalkthroughKey = wtKey
        this._syncWalkthrough(state)
      }
    })
  }

  private _syncWalkthrough(state: ReturnType<typeof useCanvasStore.getState>): void {
    for (const [id, container] of this.containers) {
      container.setWalkthroughVisual(walkthroughNodeRole(id, state))
    }
  }

  private _syncNodes(nodes: Record<string, CanvasNode>): void {
    let added = 0
    let removed = 0

    for (const [id, node] of Object.entries(nodes)) {
      const existing = this.containers.get(id)
      if (!existing) {
        added++
        const c = new ComponentContainer(node, this.viewport)
        this.containers.set(id, c)
        this.addChild(c)
        c.setWalkthroughVisual(walkthroughNodeRole(id, useCanvasStore.getState()))
        if (useCanvasStore.getState().selectedId === id) {
          c.setSelected(true)
        }
      } else {
        existing.syncNode(node)
      }
    }
    for (const [id, container] of this.containers) {
      if (!nodes[id]) {
        removed++
        this.removeChild(container)
        container.destroy({ children: true })
        this.containers.delete(id)
      }
    }

    if (added >= 2 || (removed >= 1 && added >= 1)) {
      requestCanvasFit()
    }
  }

  private _syncSelection(
    selectedId: string | null,
    prevSelectedId?: string | null,
  ): void {
    if (prevSelectedId) {
      this.containers.get(prevSelectedId)?.setSelected(false)
    }
    if (selectedId) {
      this.containers.get(selectedId)?.setSelected(true)
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
