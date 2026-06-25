import { useState, type ReactNode } from 'react'

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
    <div className="rounded-lg border border-gray-700/40 bg-gray-900/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-800/30"
      >
        <span className="shrink-0 text-[10px] text-gray-500" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
        <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </span>
        {hint && !open ? (
          <span className="shrink-0 truncate text-[10px] text-gray-600">{hint}</span>
        ) : null}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-gray-700/30 px-3 pb-3 pt-2">{children}</div>
      ) : null}
    </div>
  )
}
