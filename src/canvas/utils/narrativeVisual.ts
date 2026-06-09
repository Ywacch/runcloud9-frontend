import type { useCanvasStore } from '../../editor-core/stores/canvasStore'

type CanvasState = ReturnType<typeof useCanvasStore.getState>

export function narrativeStoreKey(state: CanvasState): string {
  return state.narrativeHighlightNodeIds.slice().sort().join(',')
}

export function isNarrativeHighlighted(nodeId: string, state: CanvasState): boolean {
  return state.narrativeHighlightNodeIds.includes(nodeId)
}
