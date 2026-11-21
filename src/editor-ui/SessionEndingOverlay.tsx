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
      className="absolute inset-0 z-[7] flex items-center justify-center bg-[rgba(21,21,42,0.55)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-ending-title"
      aria-busy="true"
    >
      <div className="cv-endpop flex max-w-md items-center gap-3 rounded-[10px] border border-[var(--dt-color-divider-inset)] bg-[var(--dt-color-surface)] px-3 py-2 text-[12px] text-[var(--dt-color-text)] shadow-[0_22px_44px_rgba(2,3,22,0.45)]">
        <div
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--dt-color-divider-inset)] border-t-[var(--dt-color-primary)]"
          aria-hidden="true"
        />
        <div>
          <h2
            id="session-ending-title"
            className="text-[12px] font-medium text-white"
          >
            Session time is up
          </h2>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-[var(--dt-color-text-muted)]">
            Saving your run and tearing down the live environment. You will return to
            design mode in a moment.
          </p>
        </div>
      </div>
    </div>
  )
}
