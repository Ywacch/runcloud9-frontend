import { Container } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { ComponentContainer } from '../components/ComponentContainer'
import { requestCanvasFit } from '../utils/canvasFitBridge'
import { useCanvasStore, type CanvasNode } from '../../editor-core/stores/canvasStore'
import {
  walkthroughNodeRole,
  walkthroughStoreKey,
} from '../utils/walkthroughVisual'
import {
  isNarrativeHighlighted,
  narrativeStoreKey,
} from '../utils/narrativeVisual'

function selectionKey(selectedIds: string[]): string {
  return selectedIds.slice().sort().join('|')
}

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
    this._syncMultiSelection(useCanvasStore.getState().selectedIds)

    let prevNodes = initialNodes
    let prevSelectedKey = selectionKey(useCanvasStore.getState().selectedIds)
    let prevWalkthroughKey = walkthroughStoreKey(useCanvasStore.getState())
    let prevNarrativeKey = narrativeStoreKey(useCanvasStore.getState())
    this._syncWalkthrough(useCanvasStore.getState())
    this._syncNarrative(useCanvasStore.getState())

    this.unsubscribe = useCanvasStore.subscribe((state) => {
      if (state.nodes !== prevNodes) {
        prevNodes = state.nodes
        this._syncNodes(state.nodes)
        this._syncWalkthrough(state)
        this._syncNarrative(state)
      }
      const selectedKey = selectionKey(state.selectedIds)
      if (selectedKey !== prevSelectedKey) {
        prevSelectedKey = selectedKey
        this._syncMultiSelection(state.selectedIds)
      }
      const wtKey = walkthroughStoreKey(state)
      if (wtKey !== prevWalkthroughKey) {
        prevWalkthroughKey = wtKey
        this._syncWalkthrough(state)
      }
      const narrativeKey = narrativeStoreKey(state)
      if (narrativeKey !== prevNarrativeKey) {
        prevNarrativeKey = narrativeKey
        this._syncNarrative(state)
      }
    })
  }

  private _syncNarrative(state: ReturnType<typeof useCanvasStore.getState>): void {
    for (const [id, container] of this.containers) {
      container.setNarrativeHighlight(isNarrativeHighlighted(id, state))
    }
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
        c.setNarrativeHighlight(
          isNarrativeHighlighted(id, useCanvasStore.getState()),
        )
        if (useCanvasStore.getState().selectedIds.includes(id)) {
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

  private _syncMultiSelection(selectedIds: string[]): void {
    const selected = new Set(selectedIds)
    for (const [id, container] of this.containers) {
      container.setSelected(selected.has(id))
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
