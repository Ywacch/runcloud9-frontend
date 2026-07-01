import { memo, useMemo } from 'react'
import { computeYDomain, formatChartTick, yAxisTicks } from '../lib/chartAxis'
import { fmtMs } from '../lib/format'
import { latencyReferenceLines } from '../lib/latencyPercentiles'

const CHART_HEIGHT = 72
const CHART_WIDTH = 400

const REFERENCE_STYLES = [
  { key: 'p50', label: 'Median (p50)', dash: '4 3', opacity: 0.55 },
  { key: 'mean', label: 'Mean', dash: undefined, opacity: 0.75 },
  { key: 'p95', label: '95th percentile', dash: '4 3', opacity: 0.55 },
  { key: 'p99', label: '99th percentile', dash: '4 3', opacity: 0.55 },
] as const

function LatencyNeedleChartInner({ latenciesMs }: { latenciesMs: number[] }) {
  const refs = useMemo(() => latencyReferenceLines(latenciesMs), [latenciesMs])
  const domain = useMemo(() => {
    const all = [
      ...latenciesMs,
      refs.p50,
      refs.mean,
      refs.p95,
      refs.p99,
    ]
    return computeYDomain(all)
  }, [latenciesMs, refs])

  const ticks = yAxisTicks(domain.min, domain.max, 3)
  const span = domain.max - domain.min || 1
  const yFor = (ms: number) => CHART_HEIGHT - ((ms - domain.min) / span) * CHART_HEIGHT
  const step = CHART_WIDTH / latenciesMs.length
  const barW = Math.max(0.75, step * 0.72)

  const refLines = [
    { ...REFERENCE_STYLES[0], value: refs.p50 },
    { ...REFERENCE_STYLES[1], value: refs.mean },
    { ...REFERENCE_STYLES[2], value: refs.p95 },
    { ...REFERENCE_STYLES[3], value: refs.p99 },
  ]

  return (
    <div className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)]/90 p-2.5 shadow-[var(--c9-shadow-card)]">
      <div>
        <p className="text-[11px] font-medium text-[var(--c9-text)]">
          Client-path latency
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--c9-text-disabled)]">
          Last {latenciesMs.length} requests · Vegeta → LB → app
        </p>
      </div>
      <div className="mt-1.5 flex gap-2">
        <div
          className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[9px] leading-none text-[var(--c9-text-disabled)]"
          style={{ height: CHART_HEIGHT }}
          aria-hidden
        >
          {ticks.map((t, i) => (
            <span key={i}>{formatChartTick(t)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-[72px] w-full text-[var(--c9-text-muted)]"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Latency needles for ${latenciesMs.length} recent requests`}
          >
            {ticks.map((t, i) => {
              const y = yFor(t)
              return (
                <line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={CHART_WIDTH}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {refLines.map((line) => {
              const y = yFor(line.value)
              return (
                <line
                  key={line.key}
                  x1={0}
                  y1={y}
                  x2={CHART_WIDTH}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={line.opacity}
                  strokeWidth={line.key === 'mean' ? 1.25 : 1}
                  strokeDasharray={line.dash}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {latenciesMs.map((ms, i) => {
              const x = i * step + (step - barW) / 2
              const yTop = yFor(ms)
              const yBase = CHART_HEIGHT
              return (
                <line
                  key={i}
                  x1={x + barW / 2}
                  y1={yBase}
                  x2={x + barW / 2}
                  y2={yTop}
                  stroke="var(--c9-info, #6366f1)"
                  strokeOpacity={0.85}
                  strokeWidth={barW}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>
        </div>
      </div>
      <ul className="mt-1.5 space-y-0.5 font-mono text-[9px] text-[var(--c9-text-muted)]">
        {refLines.map((line) => (
          <li key={line.key} className="flex items-baseline justify-between gap-2">
            <span className="truncate">{line.label}</span>
            <span className="shrink-0 text-[var(--c9-text)]">{fmtMs(line.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const LatencyNeedleChart = memo(function LatencyNeedleChart({
  latenciesMs,
}: {
  latenciesMs: number[]
}) {
  if (latenciesMs.length < 2) return null
  return <LatencyNeedleChartInner latenciesMs={latenciesMs} />
})
