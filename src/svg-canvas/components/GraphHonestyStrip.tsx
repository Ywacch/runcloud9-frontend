/** Persistent design-mode banner when the graph would fail create. */
export function GraphHonestyStrip({
  message,
  collapseLabel,
  onCollapse,
}: {
  message: string
  /** Optional fix for multi app-server / multi worker. */
  collapseLabel?: string
  onCollapse?: () => void
}) {
  const canCollapse = Boolean(collapseLabel && onCollapse)

  return (
    <div
      className={`absolute left-1/2 top-16 z-20 max-w-xl -translate-x-1/2 rounded-lg border border-red-500/40 bg-[var(--c9-surface)]/95 px-4 py-2.5 text-center shadow-lg backdrop-blur-sm ${
        canCollapse ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      data-graph-honesty
      role="status"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
        Design cannot deploy
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--c9-text)]">{message}</p>
      {canCollapse ? (
        <button
          type="button"
          className="mt-2 rounded-md border border-red-400/50 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/25"
          onClick={onCollapse}
        >
          {collapseLabel}
        </button>
      ) : null}
    </div>
  )
}
