import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { backendComponentToCanvasType } from './typeMapping'

/** Backend component that emits cache-vs-database evidence (sampled cache hits). */
export const CACHE_TRACE_LOG_COMPONENT = 'app-server'

export function selectNodeForBackendComponent(component: string): boolean {
  const canvasType = backendComponentToCanvasType[component]
  if (!canvasType) return false
  const nodes = useCanvasStore.getState().nodes
  const match = Object.values(nodes).find((n) => n.type === canvasType)
  if (!match) return false
  useCanvasStore.getState().selectNode(match.id)
  return true
}

/** Highlight a request in logs and open the inspector Logs tab on the right component. */
export function openTrace(
  requestId: string,
  opts?: { logComponent?: string },
): void {
  const id = requestId.trim()
  if (!id) return
  useLogStore.getState().setActiveTraceId(id)
  useLogStore.getState().requestInspectorTab('logs')
  if (opts?.logComponent) {
    selectNodeForBackendComponent(opts.logComponent)
  }
}

export function isCacheDbStaleEvent(detail?: Record<string, string>): boolean {
  return detail?.kind === 'cache_db_stale'
}
