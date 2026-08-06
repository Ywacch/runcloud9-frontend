import {
  formatRelativeTime,
  parseTimelineMember,
} from '../lib/timelineMember'

export function TimelineCard({
  member,
  rank,
}: {
  member: string
  rank: number
}) {
  const data = parseTimelineMember(member)
  if (!data) {
    return (
      <div className="border-b border-[var(--c9-border)] px-3 py-3 font-mono text-[10px] text-[var(--c9-muted)]">
        <span className="text-[var(--c9-text)]">#{rank}</span> Unreadable member
      </div>
    )
  }

  const age = formatRelativeTime(data.createdAt)
  const initial =
    data.authorId.length <= 2
      ? data.authorId
      : data.authorId.slice(0, 2).toUpperCase()

  return (
    <article className="border-b border-[var(--c9-border)] px-3 py-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--c9-accent)]/25 text-xs font-bold text-[var(--c9-accent)] ring-1 ring-[var(--c9-accent)]/40"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-[var(--c9-text)]">
            User {data.authorId}
          </span>
          <span className="ml-2 text-xs text-[var(--c9-muted)]">· {age}</span>
        </div>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-[var(--c9-text)]">
        {data.content}
      </p>
    </article>
  )
}
