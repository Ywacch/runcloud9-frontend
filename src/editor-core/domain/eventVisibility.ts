export type EventVisibility = 'student' | 'operator' | 'all'

/** Parse visibility from the metrics stream, including legacy audience aliases. */
export function parseEventVisibility(
  visibility: unknown,
  legacyAudience?: unknown,
): EventVisibility | undefined {
  const raw = visibility ?? legacyAudience
  if (raw === 'student' || raw === 'operator' || raw === 'all') {
    return raw
  }
  if (raw === 'both') {
    return 'all'
  }
  if (raw === 'user') {
    return 'student'
  }
  return undefined
}
