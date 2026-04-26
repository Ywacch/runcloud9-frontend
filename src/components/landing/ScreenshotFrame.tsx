type ScreenshotFrameProps = {
  screenshotSrc?: string
  alt?: string
  className?: string
}

export function ScreenshotFrame({
  screenshotSrc,
  alt = 'RunCloud9 canvas preview',
  className,
}: ScreenshotFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--c9-border)] ring-1 ring-[var(--c9-border)] shadow-2xl shadow-indigo-950/40 ${className ?? ''}`}
    >
      <div className="flex items-center gap-3 border-b border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" />
        <span className="h-3 w-3 rounded-full bg-green-500" />
        <div className="mx-4 max-w-[200px] flex-1 rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-1 text-center text-xs text-[var(--c9-muted)]">
          www.runcloud9.io
        </div>
      </div>
      <div className="flex aspect-video items-center justify-center bg-[var(--c9-bg)]">
        {screenshotSrc ? (
          <img
            src={screenshotSrc}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-1/2 w-2/3 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--c9-border)] p-4">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M4 8h16M4 16h16M8 4v16M16 4v16"
                stroke="var(--c9-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-xs text-[var(--c9-muted)]">Canvas preview</p>
          </div>
        )}
      </div>
    </div>
  )
}
