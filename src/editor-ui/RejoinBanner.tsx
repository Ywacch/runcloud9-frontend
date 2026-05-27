interface Props {
  deploymentName: string
  expiresAt: string
  onRejoin: () => void
  onDismiss: () => void
}

export function RejoinBanner({
  deploymentName,
  expiresAt,
  onRejoin,
  onDismiss,
}: Props) {
  const ends = new Date(expiresAt)
  const minsLeft = Math.max(
    0,
    Math.round((ends.getTime() - Date.now()) / 60000),
  )

  return (
    <div className="pointer-events-auto w-full max-w-xl rounded-lg border border-emerald-500/50 bg-emerald-950/80 px-3 py-2 text-xs text-emerald-50 shadow-md backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-700/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50">
          Active deployment detected
        </span>
        <span className="truncate font-mono text-[11px]" title={deploymentName}>
          {deploymentName}
        </span>
        <span className="text-emerald-200/80">
          ({minsLeft} min left)
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-emerald-500/70 bg-transparent px-2 py-0.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/60"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onRejoin}
            className="rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Rejoin
          </button>
        </div>
      </div>
    </div>
  )
}

