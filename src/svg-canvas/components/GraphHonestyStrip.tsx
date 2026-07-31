/** Persistent design-mode banner when the graph would fail create. */
export function GraphHonestyStrip({ message }: { message: string }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-16 z-20 max-w-xl -translate-x-1/2 rounded-lg border border-red-500/40 bg-[var(--c9-surface)]/95 px-4 py-2.5 text-center shadow-lg backdrop-blur-sm"
      data-graph-honesty
      role="status"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
        Design cannot deploy
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--c9-text)]">{message}</p>
    </div>
  )
}
