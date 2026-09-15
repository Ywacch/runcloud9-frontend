import { useEffect, useRef, useState } from 'react'
import type { LatencyQuantile } from '../lib/latencyQuantile'
import type { MetricsTimeframe } from '../lib/metricTimeframe'

const OPTIONS: LatencyQuantile[] = ['p50', 'p95', 'p99']

export function LatencyQuantileLabel({
  quantile,
  timeframe,
  sessionAvailable,
  onChange,
}: {
  quantile: LatencyQuantile
  timeframe: MetricsTimeframe
  sessionAvailable: (q: LatencyQuantile) => boolean
  onChange: (q: LatencyQuantile) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const prefix = timeframe === 'session' ? 'Latency ' : 'Latency ('

  return (
    <span ref={rootRef} className="relative inline-flex items-center gap-0.5">
      {timeframe === 'session' ? (
        <span>{prefix}</span>
      ) : (
        <span>Latency (</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded px-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:bg-gray-800/80 hover:text-gray-200"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {quantile}
        <span aria-hidden className="text-[8px] leading-none">
          ▾
        </span>
      </button>
      {timeframe === 'live' ? <span>)</span> : null}
      {open ? (
        <span
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-[5.5rem] rounded border border-gray-700 bg-gray-900 py-1 shadow-lg"
        >
          {OPTIONS.map((option) => {
            const disabled =
              timeframe === 'session' && !sessionAvailable(option)
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={quantile === option}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  onChange(option)
                  setOpen(false)
                }}
                className={`block w-full px-2 py-1 text-left font-mono text-[10px] ${
                  quantile === option ? 'bg-violet-950/50 text-violet-200' : 'text-gray-300'
                } ${disabled ? 'cursor-not-allowed text-gray-600' : 'hover:bg-gray-800'}`}
              >
                {option}
                {disabled ? ' (n/a)' : ''}
              </button>
            )
          })}
        </span>
      ) : null}
    </span>
  )
}
