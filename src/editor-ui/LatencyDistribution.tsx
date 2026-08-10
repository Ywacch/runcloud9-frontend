import { fmtMs } from '../lib/format'

export interface LatencyDistributionProps {
  p50Ms?: number
  p95Ms?: number
  p99Ms?: number
  label?: string
  compact?: boolean
}

function hasPositiveLatency(...values: Array<number | undefined>): boolean {
  return values.some((v) => v != null && v > 0)
}

/** Renders p50 / p95 / p99 latency summary (values already in milliseconds). */
export function LatencyDistribution({
  p50Ms,
  p95Ms,
  p99Ms,
  label,
  compact = false,
}: LatencyDistributionProps) {
  if (!hasPositiveLatency(p50Ms, p95Ms, p99Ms)) return null

  const textClass = compact ? 'text-[10px]' : 'text-[11px]'
  const valueClass = compact ? 'font-mono text-[10px]' : 'font-mono text-[11px]'

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {label ? (
        <p className={`font-medium text-[var(--c9-text-disabled)] ${textClass}`}>{label}</p>
      ) : null}
      <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${textClass} text-[var(--c9-text)]`}>
        {p50Ms != null && p50Ms > 0 ? (
          <span>
            <span className="text-[var(--c9-text-disabled)]">p50 </span>
            <span className={valueClass}>{fmtMs(p50Ms)}</span>
          </span>
        ) : null}
        {p95Ms != null && p95Ms > 0 ? (
          <span>
            <span className="text-[var(--c9-text-disabled)]">p95 </span>
            <span className={valueClass}>{fmtMs(p95Ms)}</span>
          </span>
        ) : null}
        {p99Ms != null && p99Ms > 0 ? (
          <span>
            <span className="text-[var(--c9-text-disabled)]">p99 </span>
            <span className={valueClass}>{fmtMs(p99Ms)}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
