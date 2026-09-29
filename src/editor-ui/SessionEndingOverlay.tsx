import { useCanvasStore } from '../editor-core/stores/canvasStore'

/**
 * Shown when the client session clock has elapsed and we are saving the run
 * before returning to design mode.
 */
export function SessionEndingOverlay() {
  const ending = useCanvasStore((s) => s.liveSessionEnding)
  const mode = useCanvasStore((s) => s.mode)
  if (!ending || mode !== 'live') return null

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-ending-title"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 p-6 text-center shadow-xl">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--c9-border)] border-t-[var(--c9-accent)]"
          aria-hidden="true"
        />
        <h2
          id="session-ending-title"
          className="text-lg font-semibold text-[var(--c9-text)]"
        >
          Session time is up
        </h2>
        <p className="mt-2 text-sm text-[var(--c9-muted)]">
          Saving your run and tearing down the live environment. You will return to
          design mode in a moment.
        </p>
      </div>
    </div>
  )
}
