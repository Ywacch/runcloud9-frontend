import { useState, type ReactNode } from 'react'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={`shrink-0 text-[var(--c9-text-disabled)] transition-transform duration-150 ${
        open ? 'rotate-90' : ''
      }`}
    >
      <path
        d="M3 1.5 7.5 5 3 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Collapsible block for secondary inspector metrics (metrics-component-panels §5). */
export function InspectorDisclosure({
  title,
  children,
  defaultOpen = false,
  hint,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  hint?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-card)]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--c9-bg-card)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--c9-accent)]/50"
      >
        <ChevronIcon open={open} />
        <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
          {title}
        </span>
        {hint && !open ? (
          <span className="shrink-0 truncate text-[10px] text-[var(--c9-text-disabled)]">
            {hint}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[var(--c9-border)]/70 px-3 pb-3 pt-2.5">
          {children}
        </div>
      ) : null}
    </div>
  )
}
