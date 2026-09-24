import type { SessionEventSummary } from './eventsSummaryFromApi'

/** True when the API attached a verified caption with model-inferred grounding. */
export function showModelInferenceBadge(event: SessionEventSummary): boolean {
  return event.caption?.grounding === 'inferred'
}

/** Prose shown for a highlight: verified caption when present, else authored narrative. */
export function highlightDisplayBody(event: SessionEventSummary): string {
  const caption = event.caption?.text?.trim()
  if (caption) return caption
  const narrative = event.narrative?.trim()
  if (narrative) return narrative
  return event.rule
}

/** Lowercase tokens for replay chart matching (SessionSummary spark heuristics). */
export function highlightEventSearchText(event: SessionEventSummary): string {
  return [
    event.component,
    event.rule,
    event.narrative,
    event.caption?.text,
    ...(event.related ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
