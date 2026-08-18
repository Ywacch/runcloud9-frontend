import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_MAX_W = 17.5rem
const VIEWPORT_MARGIN = 8
const GAP = 6

function measureTooltipPosition(anchor: HTMLElement, tip: HTMLElement): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect()
  const tipWidth = tip.offsetWidth
  const tipHeight = tip.offsetHeight
  const vw = window.innerWidth

  let left = rect.left + rect.width / 2 - tipWidth / 2
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, vw - VIEWPORT_MARGIN - tipWidth),
  )

  let top = rect.top - GAP - tipHeight
  if (top < VIEWPORT_MARGIN) {
    top = rect.bottom + GAP
  }

  return { top, left }
}

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const close = useCallback(() => setOpen(false), [])

  const updatePosition = useCallback(() => {
    const anchor = buttonRef.current
    const tip = tipRef.current
    if (!anchor || !tip) return
    setPos(measureTooltipPosition(anchor, tip))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    requestAnimationFrame(updatePosition)
  }, [open, text, updatePosition])

  useEffect(() => {
    if (!open) return
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePosition])

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

  const tooltipClass =
    'fixed z-[120] rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--c9-text)] shadow-lg pointer-events-none'

  return (
    <span
      ref={rootRef}
      className={`inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
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
      {open
        ? createPortal(
            <span
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className={tooltipClass}
              style={{
                top: pos.top,
                left: pos.left,
                width: `min(${TOOLTIP_MAX_W}, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
              }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
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
