import { recordCanvasHistory } from './canvasHistory'
import {
  applySingletonCollapse,
  planSingletonCollapse,
  type SingletonCollapsePlan,
} from './collapseSingleton'
import { useCanvasStore } from '../editor-core/stores/canvasStore'

/** Plan + apply collapse against the live canvas store (one undo step). */
export function collapseMultiSingletonOnCanvas(
  maxAllowed: number,
): SingletonCollapsePlan | null {
  const st = useCanvasStore.getState()
  const plan = planSingletonCollapse(st.nodes, st.edges, maxAllowed)
  if (!plan) return null

  const next = applySingletonCollapse(st.nodes, st.edges, plan)
  recordCanvasHistory(st.nodes, st.edges)
  useCanvasStore.setState({
    nodes: next.nodes,
    edges: next.edges,
    selectedId: plan.keepId,
    selectedIds: [plan.keepId],
    pendingSourceId: null,
  })
  return plan
}
