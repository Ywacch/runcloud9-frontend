import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  recordCanvasHistory,
  withoutCanvasHistoryRecording,
} from './canvasHistory'
import { autoArrangeByDependencyLayers } from './autoArrange'

/**
 * Apply dependency-layer auto-arrange onto canvasStore positions, then fit.
 * Shared by Sidebar and auto-LB inject so Pixi and SVG hosts both pick up
 * the same lattice write + fit bridge.
 *
 * @returns false when there is nothing to arrange.
 */
export function applyAutoArrange(options?: {
  /** When false, skip undo snapshot (e.g. nested inside another mutation). */
  recordHistory?: boolean
}): boolean {
  const st = useCanvasStore.getState()
  const nodeList = Object.values(st.nodes)
  if (nodeList.length === 0) return false
  const nextPositions = autoArrangeByDependencyLayers(
    nodeList,
    Object.values(st.edges),
  )
  if (options?.recordHistory !== false) {
    recordCanvasHistory(st.nodes, st.edges)
  }
  withoutCanvasHistoryRecording(() => {
    const live = useCanvasStore.getState()
    for (const [id, pos] of Object.entries(nextPositions)) {
      live.updateNodePosition(id, pos)
    }
  })
  requestCanvasFit()
  return true
}
