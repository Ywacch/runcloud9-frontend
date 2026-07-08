import type { ReactNode } from 'react'

export function MetricHelpIcon({ title }: { title: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-gray-600 bg-gray-800/80 text-[9px] font-bold leading-none text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
      title={title}
      aria-label={title}
    >
      ?
    </button>
  )
}

/** Compact hover popover for pedagogical copy — no persistent disclosure chrome. */
export function HoverInsight({
  icon,
  children,
  tone = 'muted',
}: {
  icon: string
  children: ReactNode
  tone?: 'violet' | 'sky' | 'muted'
}) {
  const toneClass =
    tone === 'sky'
      ? 'text-sky-400/90'
      : tone === 'violet'
        ? 'text-violet-400/90'
        : 'text-gray-500'
  return (
    <span className="group/hover relative inline-flex max-w-full">
      <span
        tabIndex={0}
        className={`cursor-help select-none text-[10px] leading-none ${toneClass}`}
        aria-label="More info"
      >
        ↳ {icon}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-1.5 w-[min(16rem,calc(100vw-2rem))] rounded-md border border-gray-600/60 bg-gray-900/95 px-2.5 py-2 text-[10px] font-normal normal-case leading-relaxed tracking-normal text-gray-200 opacity-0 shadow-lg transition-opacity group-hover/hover:visible group-hover/hover:opacity-100 group-focus-within/hover:visible group-focus-within/hover:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}

export function MetricSectionHeading({
  children,
  help,
  className = 'mb-1 text-[10px] uppercase tracking-wider text-gray-500',
}: {
  children: React.ReactNode
  help?: string
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span>{children}</span>
      {help ? <MetricHelpIcon title={help} /> : null}
    </div>
  )
}
