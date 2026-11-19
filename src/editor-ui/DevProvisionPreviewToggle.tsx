import {
  setDevProvisionPreviewEnabled,
  useDevProvisionPreviewEnabled,
} from '../lib/devProvisionPreview'

export function DevProvisionPreviewToggle() {
  const on = useDevProvisionPreviewEnabled()
  if (!import.meta.env.DEV) return null
  return (
    <button
      type="button"
      className={`pointer-events-auto rounded-md border px-2 py-1 text-[10px] font-medium shadow backdrop-blur-sm ${
        on
          ? 'border-[var(--c9-accent)] bg-[var(--c9-surface)]/95 text-[var(--c9-text)]'
          : 'border-[var(--c9-border)] bg-[var(--c9-surface)]/95 text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
      }`}
      aria-pressed={on}
      title="Cycle in-canvas provision (ghost glyphs + strip). No fake logs. ?provision=preview"
      onClick={() => setDevProvisionPreviewEnabled(!on)}
    >
      Provision
    </button>
  )
}
