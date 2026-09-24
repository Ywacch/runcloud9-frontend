import type { SessionEventSummary } from '../lib/eventsSummaryFromApi'
import { highlightDisplayBody, showModelInferenceBadge } from '../lib/highlightCaption'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { AsPredictedBadge } from './AsPredictedBadge'
import { ModelInferenceBadge } from './ModelInferenceBadge'

function formatTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  return new Date(t).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function eventTypeLabel(type: string): string {
  if (type === 'cascade') return 'Cascade'
  if (type === 'invariant') return 'Invariant'
  if (type === 'threshold') return 'Threshold'
  return type
}

export function eventTypeClass(type: string): string {
  if (type === 'cascade') return 'text-red-300'
  if (type === 'invariant') return 'text-rose-300'
  if (type === 'threshold') return 'text-amber-200'
  return 'text-[var(--c9-muted)]'
}

export function HighlightPanel({ event }: { event: SessionEventSummary }) {
  const isPredicted = useStorytellingStore((s) => s.isPredicted(event))
  const body = highlightDisplayBody(event)
  const modelInference = showModelInferenceBadge(event)

  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${eventTypeClass(event.type)}`}>
          {eventTypeLabel(event.type)}
        </span>
        {isPredicted ? <AsPredictedBadge /> : null}
        {modelInference ? <ModelInferenceBadge /> : null}
        <time className="ml-auto font-mono text-[10px] text-[var(--c9-muted)]">
          {formatTime(event.timestamp)}
        </time>
      </div>
      <h3 className="mt-3 font-mono text-sm font-semibold leading-snug text-[var(--c9-text-heading)]">
        {event.rule}
      </h3>
      {body && body !== event.rule ? (
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[var(--c9-text)]">
          {body}
        </p>
      ) : null}
      {event.suggestion ? (
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-amber-200/90">
          {event.suggestion}
        </p>
      ) : null}
      {event.component ? (
        <p className="mt-3 font-mono text-[10px] text-[var(--c9-muted)]">{event.component}</p>
      ) : null}
    </article>
  )
}
