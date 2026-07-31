const HOW_IT_WORKS = [
  'Place components from the sidebar, or right-click empty canvas to open Add.',
  'Right-click a component for inspector, delete, and (in live) chaos actions.',
  'Use Connect to wire nodes. Click a node to open the inspector.',
  'Pick a template preset or start from scratch, then deploy or simulate.',
] as const

type ShortcutRow = { label: string; keys: string[] }

const TOOL_SHORTCUTS: ShortcutRow[] = [
  { label: 'Select', keys: ['S'] },
  { label: 'Connect', keys: ['C'] },
  { label: 'Erase', keys: ['E'] },
  { label: 'Fit view', keys: ['F'] },
  { label: 'Pan', keys: ['drag empty'] },
]

const EDITOR_SHORTCUTS: ShortcutRow[] = [
  { label: 'Undo', keys: ['Ctrl', 'Z'] },
  { label: 'Redo', keys: ['Ctrl', 'Y'] },
  { label: 'Select all', keys: ['Ctrl', 'A'] },
  { label: 'Copy', keys: ['Ctrl', 'C'] },
  { label: 'Paste', keys: ['Ctrl', 'V'] },
  { label: 'Delete', keys: ['Delete', 'or', 'Backspace'] },
  { label: 'Cancel', keys: ['Esc'] },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--c9-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {children}
    </kbd>
  )
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {keys.map((key, i) => {
        if (key === 'or') {
          return (
            <span
              key={`or-${i}`}
              className="px-0.5 text-[10px] text-[var(--c9-muted)]"
            >
              or
            </span>
          )
        }
        if (key === 'drag empty') {
          return (
            <span
              key={`drag-${i}`}
              className="text-[10px] text-[var(--c9-muted)]"
            >
              drag empty canvas
            </span>
          )
        }
        return (
          <span key={`${key}-${i}`} className="flex items-center gap-1">
            {i > 0 && keys[i - 1] !== 'or' ? (
              <span className="text-[10px] text-[var(--c9-muted)]">+</span>
            ) : null}
            <Kbd>{key}</Kbd>
          </span>
        )
      })}
    </span>
  )
}

function ShortcutList({
  title,
  rows,
}: {
  title: string
  rows: ShortcutRow[]
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        {title}
      </h3>
      <ul className="mt-2 divide-y divide-[var(--c9-border)]">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 py-2 text-sm text-[var(--c9-text)]"
          >
            <span>{row.label}</span>
            <ShortcutKeys keys={row.keys} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CanvasHelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c9-bg)]/75 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="canvas-help-title"
              className="text-lg font-semibold tracking-tight text-[var(--c9-text)]"
            >
              How the canvas works
            </h2>
            <p className="mt-1 text-sm text-[var(--c9-muted)]">
              Design a topology, then deploy or simulate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-[var(--c9-muted)] transition-colors hover:bg-[var(--c9-badge-bg)] hover:text-[var(--c9-text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--c9-text)]">
          {HOW_IT_WORKS.map((line) => (
            <li key={line} className="flex gap-2">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--c9-accent)]"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-sm font-semibold text-[var(--c9-text)]">
          Keyboard shortcuts
        </h3>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <ShortcutList title="Tools" rows={TOOL_SHORTCUTS} />
          <ShortcutList title="Editor" rows={EDITOR_SHORTCUTS} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
