import type { SessionEventSummary } from '../lib/eventsSummaryFromApi'
import { useStorytellingStore } from '../store/storytellingStore'
import { AsPredictedBadge } from './AsPredictedBadge'

function formatTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  return new Date(t).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function typeLabel(type: string): string {
  if (type === 'cascade') return 'Cascade'
  if (type === 'threshold') return 'Threshold'
  return type
}

function typeClass(type: string): string {
  if (type === 'cascade') return 'text-red-300'
  if (type === 'threshold') return 'text-amber-200'
  return 'text-[var(--c9-muted)]'
}

function HighlightCard({ event }: { event: SessionEventSummary }) {
  const isPredicted = useStorytellingStore((s) => s.isPredicted(event))
  const body =
    (event.narrative && event.narrative.trim()) ||
    event.rule

  return (
    <li className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${typeClass(event.type)}`}>
          {typeLabel(event.type)}
        </span>
        {isPredicted ? <AsPredictedBadge /> : null}
        <time className="ml-auto font-mono text-[10px] text-[var(--c9-muted)]">
          {formatTime(event.timestamp)}
        </time>
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--c9-text)]">{event.rule}</p>
      {body && body !== event.rule ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-300">{body}</p>
      ) : null}
      {event.suggestion ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
          {event.suggestion}
        </p>
      ) : null}
      {event.component ? (
        <p className="mt-1 font-mono text-[10px] text-[var(--c9-muted)]">
          {event.component}
        </p>
      ) : null}
    </li>
  )
}

export function HighlightReel({ events }: { events: SessionEventSummary[] }) {
  if (!events.length) return null

  const n = events.length
  const header =
    n === 1
      ? '1 notable event during your session'
      : `${n} notable events during your session`

  return (
    <div className="mb-4 space-y-3 border-b border-[var(--c9-border)] pb-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        Session highlights
      </h3>
      <p className="text-sm text-[var(--c9-text)]">{header}</p>
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {events.map((ev, i) => (
          <HighlightCard key={`${ev.timestamp}-${ev.rule}-${i}`} event={ev} />
        ))}
      </ul>
    </div>
  )
}
