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
