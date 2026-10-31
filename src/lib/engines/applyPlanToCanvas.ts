import type { DesignPlan } from './planSheetModel'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'

/** Removes nodes and edges listed on the deploy plan diff. */
export function applyPlanRemovalsToCanvas(plan: DesignPlan): void {
  const st = useCanvasStore.getState()
  const removeIds = new Set(plan.nodes.removed)
  if (removeIds.size === 0) return
  for (const id of removeIds) {
    if (st.nodes[id]) st.removeNode(id)
  }
}
