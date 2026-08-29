import { fmtMs } from '../lib/format'
import type { LatencyQuantile } from '../lib/latencyQuantile'

export interface LatencyDistributionProps {
  p50Ms?: number
  p95Ms?: number
  p99Ms?: number
  label?: string
  compact?: boolean
  selectedQuantile?: LatencyQuantile
  onSelectQuantile?: (quantile: LatencyQuantile) => void
}

function hasPositiveLatency(...values: Array<number | undefined>): boolean {
  return values.some((v) => v != null && v > 0)
}

function quantileClass(selected: LatencyQuantile | undefined, q: LatencyQuantile): string {
  return selected === q ? 'text-violet-200' : 'text-[var(--c9-text-disabled)]'
}

/** Renders p50 / p95 / p99 latency summary (values already in milliseconds). */
export function LatencyDistribution({
  p50Ms,
  p95Ms,
  p99Ms,
  label,
  compact = false,
  selectedQuantile,
  onSelectQuantile,
}: LatencyDistributionProps) {
  if (!hasPositiveLatency(p50Ms, p95Ms, p99Ms)) return null

  const textClass = compact ? 'text-[10px]' : 'text-[11px]'
  const valueClass = compact ? 'font-mono text-[10px]' : 'font-mono text-[11px]'

  const renderQuantile = (q: LatencyQuantile, ms: number | undefined) => {
    if (ms == null || ms <= 0) return null
    const labelClass = quantileClass(selectedQuantile, q)
    const body = (
      <>
        <span className={labelClass}>{q} </span>
        <span className={valueClass}>{fmtMs(ms)}</span>
      </>
    )
    if (onSelectQuantile) {
      return (
        <button
          key={q}
          type="button"
          onClick={() => onSelectQuantile(q)}
          className={`rounded px-0.5 transition-colors hover:bg-gray-800/80 ${labelClass}`}
        >
          {body}
        </button>
      )
    }
    return (
      <span key={q}>
        {body}
      </span>
    )
  }

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {label ? (
        <p className={`font-medium text-[var(--c9-text-disabled)] ${textClass}`}>{label}</p>
      ) : null}
      <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${textClass} text-[var(--c9-text)]`}>
        {renderQuantile('p50', p50Ms)}
        {renderQuantile('p95', p95Ms)}
        {renderQuantile('p99', p99Ms)}
      </div>
    </div>
  )
}
