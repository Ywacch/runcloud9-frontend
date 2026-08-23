import { useLogStore } from '../editor-core/stores/logStore'
import { CACHE_TRACE_LOG_COMPONENT, openTrace } from '../lib/openTrace'

/** Highlights matching request_id lines and opens the right inspector log stream. */
export function ViewTraceButton({
  requestId,
  logComponent,
}: {
  requestId: string
  /** Backend log component to open (defaults to app-server for cache evidence). */
  logComponent?: string
}) {
  const id = requestId.trim()
  if (!id) return null
  return (
    <button
      type="button"
      onClick={() =>
        openTrace(id, { logComponent: logComponent ?? CACHE_TRACE_LOG_COMPONENT })
      }
      className="font-medium text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
    >
      View trace
    </button>
  )
}
