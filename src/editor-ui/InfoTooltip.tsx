import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * T2 helper: short explanation on a label (hover / focus / tap).
 * Prefer ≤120 characters.
 */
export function InfoTooltip({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const tipId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const el = rootRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[var(--c9-border)] bg-[var(--c9-bg-subtle)] text-[9px] font-bold leading-none text-[var(--c9-muted)] transition-colors hover:border-[var(--c9-border-strong)] hover:text-[var(--c9-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)]"
        aria-label={text}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          const next = e.relatedTarget
          if (next instanceof Node && rootRef.current?.contains(next)) return
          close()
        }}
      >
        ?
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-[min(17.5rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--c9-text)] shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}

/** Label row helper: label text + optional InfoTooltip. */
export function LabelWithInfo({
  htmlFor,
  className,
  children,
  info,
}: {
  htmlFor?: string
  className?: string
  children: ReactNode
  info?: string
}) {
  return (
    <label className={className} htmlFor={htmlFor}>
      <span className="inline-flex items-center gap-1">
        {children}
        {info ? <InfoTooltip text={info} /> : null}
      </span>
    </label>
  )
}
