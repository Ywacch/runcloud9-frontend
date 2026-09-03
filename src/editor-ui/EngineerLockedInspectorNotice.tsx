/** Read-only notice when a free user inspects a plan-restricted node in full preview. */
export function EngineerLockedInspectorNotice() {
  return (
    <div className="rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)] px-3 py-2.5 text-xs leading-snug text-[var(--c9-muted)]">
      <p className="font-medium text-[var(--c9-text)]">Preview only</p>
      <p className="mt-1">
        This component is not deployable on your plan. Switch to the Free tier
        design to deploy without it.
      </p>
    </div>
  )
}
