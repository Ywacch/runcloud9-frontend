import { useLogStore } from '../editor-core/stores/logStore'

/** Highlights matching request_id lines in the log panels. */
export function ViewTraceButton({ requestId }: { requestId: string }) {
  const id = requestId.trim()
  if (!id) return null
  return (
    <button
      type="button"
      onClick={() => useLogStore.getState().setActiveTraceId(id)}
      className="font-medium text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
    >
      View trace
    </button>
  )
}
