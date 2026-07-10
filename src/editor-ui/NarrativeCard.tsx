import { useEffect } from 'react'
import { crashContextLines } from '../lib/crashContextDisplay'
import { nodeIdsForRelatedBackendComponents } from '../lib/narrativeHighlight'
import type { WsEvent } from '../editor-core/stores/metricsStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { AsPredictedBadge } from './AsPredictedBadge'

const PRETTY_RELATED: Record<string, string> = {
  lb: 'Load balancer',
  'app-server': 'App server',
  cache: 'Redis',
  db: 'Postgres',
  mq: 'Message queue',
  worker: 'Worker',
}

interface NarrativeCardProps {
  event: WsEvent
  onClose: () => void
}

export function NarrativeCard({ event, onClose }: NarrativeCardProps) {
  const isPredicted = useStorytellingStore((s) => s.isPredicted(event))
  const body = (event.narrative && event.narrative.trim()) || event.description
  const crashLines = event.crashContext ? crashContextLines(event.crashContext) : []
  const relatedChain =
    event.related?.map((r) => PRETTY_RELATED[r] ?? r).join(' → ') ?? ''

  useEffect(() => {
    const ids = nodeIdsForRelatedBackendComponents(
      event.related,
      useCanvasStore.getState().nodes
    )
    useCanvasStore.getState().setNarrativeHighlightNodeIds(ids)
    return () => {
      useCanvasStore.getState().setNarrativeHighlightNodeIds([])
    }
  }, [event.related])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="narrative-card-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,32rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 p-5 text-[var(--c9-text)] shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--c9-border)] pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2
              id="narrative-card-title"
              className="text-base font-semibold text-violet-300"
            >
              {event.title}
            </h2>
            {isPredicted ? <AsPredictedBadge /> : null}
          </div>
          <time className="shrink-0 font-mono text-[10px] text-[var(--c9-muted)]">
            {new Date(event.timestamp).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </time>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-200">{body}</p>
        {crashLines.length > 0 ? (
          <div className="mt-4 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
              Snapshot at crash
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-300">{crashLines.join(' · ')}</p>
          </div>
        ) : null}
        {relatedChain ? (
          <div className="mt-4 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
              Components
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-300">{relatedChain}</p>
          </div>
        ) : null}
        {event.suggestion && event.suggestion.trim() ? (
          <p className="mt-4 text-sm leading-relaxed text-amber-200">
            💡 {event.suggestion}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-4 py-2 text-sm text-[var(--c9-text)] hover:bg-[var(--c9-bg)]"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
