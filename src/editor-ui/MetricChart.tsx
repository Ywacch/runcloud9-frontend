import {
  computeYDomain,
  flattenSeriesValues,
  formatChartTick,
  yAxisTicks,
} from '../lib/chartAxis'
import { fmtMs, fmtPct, fmtRate } from '../lib/format'
import { SparkLine, type SparkLineSeries } from './SparkLine'

export interface MetricChartSeries {
  data: number[]
  color: string
  label?: string
  showArea?: boolean
}

export interface MetricChartProps {
  title: string
  /** Shown under title (e.g. "ms", "RPS", "rows/s"). */
  unit?: string
  series: MetricChartSeries[]
  height?: number
  /** Smaller card for inspector side panels. */
  compact?: boolean
  showDot?: boolean
  eventMarkers?: Array<{ xRatio: number; type?: string }>
  className?: string
  /** Seconds between samples (~2s on live WS). Used for hover caption. */
  sampleIntervalSec?: number
  /** Show Hybrid C replay lag hint on chart header. */
  showPlaybackDelay?: boolean
  pointCaption?: (index: number, total: number) => string
}

export function MetricChart({
  title,
  unit,
  series,
  height,
  compact = false,
  showDot = true,
  eventMarkers,
  className,
  sampleIntervalSec = 2,
  showPlaybackDelay = false,
  pointCaption: pointCaptionProp,
}: MetricChartProps) {
  const chartHeight = height ?? (compact ? 72 : 128)
  const hasData = series.some((s) => s.data.filter(Number.isFinite).length >= 2)
  if (!hasData) return null

  const domain = computeYDomain(flattenSeriesValues(series))
  const ticks = yAxisTicks(domain.min, domain.max, compact ? 3 : 4)
  const sparkSeries: SparkLineSeries[] = series.map((s, i) => ({
    data: s.data,
    color: s.color,
    showArea: s.showArea ?? true,
    label: s.label ?? (series.length === 1 ? title : `Series ${i + 1}`),
  }))
  const legend = series.filter((s) => s.label)

  const formatValue = (v: number): string => {
    const u = (unit ?? '').toLowerCase()
    if (u.includes('ms')) return fmtMs(v)
    if (u.includes('%')) return fmtPct(v)
    if (u.includes('rps') || u.includes('/s') || u.includes('queries')) {
      return `${fmtRate(v)}/s`
    }
    return formatChartTick(v, unit)
  }

  const pointCaption =
    pointCaptionProp ??
    ((index: number, total: number): string => {
      const secsAgo = (total - 1 - index) * sampleIntervalSec
      if (secsAgo <= 0) return 'Latest'
      if (secsAgo < 60) return `${secsAgo}s ago`
      const m = Math.floor(secsAgo / 60)
      const s = secsAgo % 60
      return s > 0 ? `${m}m ${s}s ago` : `${m}m ago`
    })

  return (
    <div
      className={
        className ??
        `rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)]/90 shadow-[var(--c9-shadow-card)] ${
          compact ? 'p-2.5' : 'p-3'
        }`
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`font-medium text-[var(--c9-text)] ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            {title}
          </p>
          {unit ? (
            <p className="mt-0.5 text-[10px] text-[var(--c9-text-disabled)]">
              {unit}
              {showPlaybackDelay ? (
                <span className="text-[var(--c9-text-disabled)]"> · ~5s display delay</span>
              ) : null}
            </p>
          ) : showPlaybackDelay ? (
            <p className="mt-0.5 text-[10px] text-[var(--c9-text-disabled)]">
              ~5s display delay
            </p>
          ) : null}
        </div>
        {legend.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5">
            {legend.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1 text-[9px] text-[var(--c9-text-muted)]"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={`flex gap-2 ${compact ? 'mt-1.5' : 'mt-3'}`}>
        <div
          className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[9px] leading-none text-[var(--c9-text-disabled)]"
          style={{ height: chartHeight }}
          aria-hidden
        >
          {ticks.map((t, i) => (
            <span key={i}>{formatChartTick(t)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <SparkLine
            series={sparkSeries}
            width={400}
            height={chartHeight}
            showGrid
            gridLines={ticks.length}
            yMin={domain.min}
            yMax={domain.max}
            showDot={showDot}
            eventMarkers={eventMarkers}
            interactive
            formatValue={formatValue}
            pointCaption={pointCaption}
          />
        </div>
      </div>
    </div>
  )
}
