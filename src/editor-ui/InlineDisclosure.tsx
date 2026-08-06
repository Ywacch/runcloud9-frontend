import { useState, type ReactNode } from 'react'

/**
 * T3 helper: collapsed teaching copy. Lighter than InspectorDisclosure
 * (no card chrome — text + left border when open).
 */
export function InlineDisclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="pt-0.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer text-left text-[10px] text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span> {label}
      </button>
      {open ? (
        <div className="mt-1.5 border-l-2 border-[var(--c9-border)] pl-3 text-[11px] leading-relaxed text-[var(--c9-muted)]">
          {children}
        </div>
      ) : null}
    </div>
  )
}
