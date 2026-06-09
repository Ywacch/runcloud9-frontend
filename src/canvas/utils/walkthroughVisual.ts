import type { useCanvasStore } from '../../editor-core/stores/canvasStore'

type CanvasState = ReturnType<typeof useCanvasStore.getState>

export type WalkthroughNodeRole = 'off' | 'active' | 'visited' | 'participating' | 'hidden'

export function isWalkthroughRunning(state: CanvasState): boolean {
  return (
    state.mode === 'design' &&
    (state.walkthroughActiveNodeId != null ||
      state.walkthroughParticipatingNodeIds.length > 0)
  )
}

export function walkthroughNodeRole(nodeId: string, state: CanvasState): WalkthroughNodeRole {
  if (!isWalkthroughRunning(state)) return 'off'
  if (state.walkthroughActiveNodeId === nodeId) return 'active'
  if (state.walkthroughVisitedNodeIds.includes(nodeId)) return 'visited'
  if (state.walkthroughParticipatingNodeIds.includes(nodeId)) return 'participating'
  return 'hidden'
}

export function walkthroughNodeAlpha(role: WalkthroughNodeRole): number {
  switch (role) {
    case 'off':
    case 'active':
      return 1
    case 'visited':
      return 0.92
    case 'participating':
      return 0.55
    case 'hidden':
      return 0.25
  }
}

export interface WalkthroughEdgeStyle {
  color: number
  alpha: number
  width: number
  highlighted: boolean
}

export function walkthroughEdgeStyle(
  edgeId: string,
  sourceId: string,
  targetId: string,
  edge: { animated: boolean },
  state: CanvasState,
): WalkthroughEdgeStyle {
  const baseColor = edge.animated ? 0x00aeef : 0x8892b0
  const baseAlpha = edge.animated ? 1.0 : 0.7
  const baseWidth = edge.animated ? 2 : 1.5

  if (!isWalkthroughRunning(state)) {
    return { color: baseColor, alpha: baseAlpha, width: baseWidth, highlighted: false }
  }

  const highlighted = state.walkthroughHighlightedEdgeIds.includes(edgeId)
  if (highlighted) {
    return { color: 0x22d3ee, alpha: 1, width: 3, highlighted: true }
  }

  const onPath =
    state.walkthroughParticipatingNodeIds.includes(sourceId) &&
    state.walkthroughParticipatingNodeIds.includes(targetId)

  return {
    color: baseColor,
    alpha: onPath ? 0.35 : 0.12,
    width: baseWidth,
    highlighted: false,
  }
}

export function walkthroughStoreKey(state: CanvasState): string {
  return [
    state.mode,
    state.walkthroughActiveNodeId ?? '',
    state.walkthroughVisitedNodeIds.join(','),
    state.walkthroughHighlightedEdgeIds.join(','),
    state.walkthroughParticipatingNodeIds.join(','),
  ].join('|')
}
