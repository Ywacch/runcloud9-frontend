type ScreenshotFrameProps = {
  screenshotSrc?: string
  alt?: string
  className?: string
}

const SHOT_MASK = {
  maskImage:
    'radial-gradient(ellipse 78% 82% at 50% 48%, black 55%, transparent 88%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 78% 82% at 50% 48%, black 55%, transparent 88%)',
} as const

export function ScreenshotFrame({
  screenshotSrc,
  alt = 'RunCloud9 canvas preview',
  className,
}: ScreenshotFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--c9-border)] ring-1 ring-[var(--c9-border)] shadow-2xl shadow-black/40 ${className ?? ''}`}
    >
      {screenshotSrc ? (
        <img
          src={screenshotSrc}
          alt={alt}
          className="block h-auto w-full bg-[var(--c9-bg-surface)] object-contain"
          style={SHOT_MASK}
          decoding="async"
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-[var(--c9-bg)] p-4">
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
  )
}
