import {
  setProjectionMode,
  useProjectionMode,
  type ProjectionMode,
} from '../store/projectionStore'

const OPTIONS: { value: ProjectionMode; label: string }[] = [
  { value: 'iso', label: 'Iso' },
  { value: 'flat', label: 'Flat' },
]

/** Switches the canvas between isometric and top-down. */
export function ProjectionToggle() {
  const mode = useProjectionMode()
  return (
    <div
      className="pointer-events-auto flex rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 p-0.5 shadow-sm backdrop-blur-sm"
      role="group"
      aria-label="Projection"
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`rounded px-2 py-1 text-[10px] ${
            mode === value
              ? 'bg-[var(--c9-bg-subtle)] text-[var(--c9-text)]'
              : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
          }`}
          aria-pressed={mode === value}
          onClick={() => setProjectionMode(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
