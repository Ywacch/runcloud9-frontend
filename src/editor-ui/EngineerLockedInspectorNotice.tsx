/** Read-only notice when Explorer inspects an Engineer-only node in full preview. */
export function EngineerLockedInspectorNotice() {
  return (
    <div className="rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)] px-3 py-2.5 text-xs leading-snug text-[var(--c9-muted)]">
      <p className="font-medium text-[var(--c9-text)]">Engineer component</p>
      <p className="mt-1">
        Preview only on Explorer. Upgrade to deploy this node, or switch to the
        Explorer runnable preset.
      </p>
    </div>
  )
}
