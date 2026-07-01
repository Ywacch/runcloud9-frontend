import { memo, useMemo } from 'react'
import type { ClientLatencyInterval } from '../editor-core/domain/sessionHistoryFromApi'
import { computeYDomain, formatChartTick, yAxisTicks } from '../lib/chartAxis'
import { fmtMs } from '../lib/format'
import { boxPlotQuartiles, percentileSorted } from '../lib/latencyPercentiles'

const CHART_HEIGHT = 88
const CHART_WIDTH = 400
const BOX_WIDTH = 52
const WHISKER_CAP = 14

function ClientLatencyBoxChartInner({
  intervals,
}: {
  intervals: ClientLatencyInterval[]
}) {
  const p99Ms = useMemo(
    () => intervals.map((row) => row.p99Ms),
    [intervals],
  )
  const box = useMemo(() => boxPlotQuartiles(p99Ms), [p99Ms])
  const sorted = useMemo(
    () => [...p99Ms].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b),
    [p99Ms],
  )
  const sessionP95 = useMemo(
    () => (sorted.length > 0 ? percentileSorted(sorted, 95) : 0),
    [sorted],
  )

  if (!box) return null

  const domain = computeYDomain([
    box.whiskerMin,
    box.q1,
    box.median,
    box.q3,
    box.whiskerMax,
    ...p99Ms,
  ])
  const ticks = yAxisTicks(domain.min, domain.max, 3)
  const span = domain.max - domain.min || 1
  const yFor = (ms: number) => CHART_HEIGHT - ((ms - domain.min) / span) * CHART_HEIGHT

  const cx = CHART_WIDTH / 2
  const boxLeft = cx - BOX_WIDTH / 2
  const yQ1 = yFor(box.q1)
  const yQ3 = yFor(box.q3)
  const yMedian = yFor(box.median)
  const yMin = yFor(box.whiskerMin)
  const yMax = yFor(box.whiskerMax)
  const boxHeight = Math.max(1, yQ1 - yQ3)

  return (
    <div className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)]/90 p-2.5 shadow-[var(--c9-shadow-card)]">
      <div className="flex gap-2">
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
            className="h-[88px] w-full text-[var(--c9-text-muted)]"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Client p99 distribution across ${intervals.length} five-second windows`}
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
            <line
              x1={cx}
              y1={yMin}
              x2={cx}
              y2={yMax}
              stroke="var(--c9-info, #6366f1)"
              strokeOpacity={0.75}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={cx - WHISKER_CAP / 2}
              y1={yMin}
              x2={cx + WHISKER_CAP / 2}
              y2={yMin}
              stroke="var(--c9-info, #6366f1)"
              strokeOpacity={0.75}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={cx - WHISKER_CAP / 2}
              y1={yMax}
              x2={cx + WHISKER_CAP / 2}
              y2={yMax}
              stroke="var(--c9-info, #6366f1)"
              strokeOpacity={0.75}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={boxLeft}
              y={yQ3}
              width={BOX_WIDTH}
              height={boxHeight}
              fill="var(--c9-info, #6366f1)"
              fillOpacity={0.18}
              stroke="var(--c9-info, #6366f1)"
              strokeOpacity={0.85}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={boxLeft}
              y1={yMedian}
              x2={boxLeft + BOX_WIDTH}
              y2={yMedian}
              stroke="var(--c9-info, #6366f1)"
              strokeOpacity={0.95}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[9px] text-[var(--c9-text-muted)]">
        <div className="flex items-baseline justify-between gap-2">
          <span>Median p99</span>
          <span className="text-[var(--c9-text)]">{fmtMs(box.median)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span>Session p95 p99</span>
          <span className="text-[var(--c9-text)]">{fmtMs(sessionP95)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span>Windows</span>
          <span className="text-[var(--c9-text)]">{intervals.length}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span>IQR</span>
          <span className="text-[var(--c9-text)]">{fmtMs(box.q3 - box.q1)}</span>
        </div>
      </div>
    </div>
  )
}

export const ClientLatencyBoxChart = memo(function ClientLatencyBoxChart({
  intervals,
}: {
  intervals: ClientLatencyInterval[]
}) {
  if (intervals.length < 4) return null
  return <ClientLatencyBoxChartInner intervals={intervals} />
})
