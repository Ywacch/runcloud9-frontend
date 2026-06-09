import { isCanvasEditMode, type useCanvasStore } from '../../editor-core/stores/canvasStore'

type CanvasState = ReturnType<typeof useCanvasStore.getState>

export type ConnectNodeRole = 'off' | 'pendingSource' | 'hoverTarget'

export function connectNodeRole(nodeId: string, state: CanvasState): ConnectNodeRole {
  if (!isCanvasEditMode(state.mode) || state.designTool !== 'connect') return 'off'
  if (state.pendingSourceId === nodeId) return 'pendingSource'
  if (
    state.connectHoverTargetId === nodeId &&
    state.pendingSourceId &&
    state.pendingSourceId !== nodeId
  ) {
    return 'hoverTarget'
  }
  return 'off'
}

export function connectStoreKey(state: CanvasState): string {
  return [
    state.mode,
    state.designTool,
    state.pendingSourceId ?? '',
    state.connectHoverTargetId ?? '',
  ].join('|')
}

export function canShowConnectPreview(state: CanvasState): boolean {
  return (
    isCanvasEditMode(state.mode) &&
    state.designTool === 'connect' &&
    state.pendingSourceId != null &&
    state.connectHoverTargetId != null &&
    state.pendingSourceId !== state.connectHoverTargetId
  )
}
