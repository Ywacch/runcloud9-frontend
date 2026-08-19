import { useEffect } from 'react'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { AsPredictedBadge } from './AsPredictedBadge'

/** Brief banner when the latest batch included an `invariant` event. */
export function InvariantToast() {
  const toast = useMetricsStore((s) => s.invariantToast)
  const dismiss = useMetricsStore((s) => s.dismissInvariantToast)
  const isPredicted = useStorytellingStore((s) =>
    toast ? s.isPredicted(toast) : false,
  )

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => {
      useMetricsStore.getState().dismissInvariantToast()
    }, 6000)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!toast) return null

  return (
    <div className="pointer-events-auto fixed bottom-20 left-1/2 z-[45] w-[min(100%,28rem)] -translate-x-1/2 rounded-lg border border-rose-800/70 bg-rose-950/95 px-3 py-2.5 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
              Invariant violated
            </span>
            {isPredicted ? <AsPredictedBadge /> : null}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white">{toast.title}</div>
          {toast.description ? (
            <div className="mt-1 text-xs leading-snug text-rose-100/90">
              {toast.description}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
