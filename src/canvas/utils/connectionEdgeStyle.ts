import {
  isCanvasEditMode,
  isMetricsViewportMode,
} from '../../editor-core/stores/canvasStore'
import {
  walkthroughEdgeStyle,
  type WalkthroughEdgeStyle,
} from './walkthroughVisual'
import type { useCanvasStore } from '../../editor-core/stores/canvasStore'

type CanvasState = ReturnType<typeof useCanvasStore.getState>

const TOPOLOGY_COLOR = 0xb91c1c
const LIVE_BASE_COLOR = 0x64748b

export function protocolLabel(protocol: 'http' | 'tcp'): string {
  return protocol === 'http' ? 'HTTP' : 'TCP'
}

export function resolveConnectionEdgeStyle(
  edgeId: string,
  sourceId: string,
  targetId: string,
  edge: { animated: boolean; protocol: 'http' | 'tcp' },
  state: CanvasState,
  topologyIssue?: string,
): WalkthroughEdgeStyle {
  let style = walkthroughEdgeStyle(edgeId, sourceId, targetId, edge, state)

  if (isMetricsViewportMode(state.mode)) {
    style = {
      ...style,
      color: LIVE_BASE_COLOR,
      alpha: 0.45,
      width: edge.animated ? 2 : 2,
    }
  }

  if (topologyIssue) {
    style = {
      ...style,
      color: TOPOLOGY_COLOR,
      width: isMetricsViewportMode(state.mode)
        ? 3
        : isCanvasEditMode(state.mode)
          ? 4
          : style.width,
    }
  }

  return style
}

export function protocolBadgeFill(topologyIssue?: string): number {
  return topologyIssue ? 0x7f1d1d : 0x1f2937
}
