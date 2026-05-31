import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { formatChartTick } from '../lib/chartAxis'

export interface SparkLineSeries {
  data: number[]
  color: string
  showArea?: boolean
  label?: string
}

export interface SparkLineProps {
  data?: number[]
  color?: string
  /** Multiple lines on one chart (shared Y scale). */
  series?: SparkLineSeries[]
  width?: number
  height?: number
  showDot?: boolean
  showArea?: boolean
  showGrid?: boolean
  gridLines?: number
  yMin?: number
  yMax?: number
  strokeWidth?: number
  /** Hover crosshair + value readout (default on for grid charts). */
  interactive?: boolean
  formatValue?: (value: number) => string
  pointCaption?: (index: number, total: number) => string
  /** Normalized 0–1 positions along the X axis (e.g. event tick marks). */
  eventMarkers?: Array<{ xRatio: number; type?: string }>
  className?: string
}

function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function markerColor(t?: string): string {
  if (t === 'cascade') return 'var(--c9-error)'
  if (t === 'threshold') return 'var(--c9-warning)'
  return 'var(--c9-info)'
}

function buildSeries(props: SparkLineProps): SparkLineSeries[] {
  if (props.series?.length) return props.series
  if (props.data?.length) {
    return [
      {
        data: props.data,
        color: props.color ?? 'var(--c9-text-muted)',
        showArea: props.showArea,
      },
    ]
  }
  return []
}

export function SparkLine({
  data,
  color = 'var(--c9-text-muted)',
  series,
  width = 120,
  height = 32,
  showDot = false,
  showArea = false,
  showGrid = false,
  gridLines = 4,
  yMin,
  yMax,
  strokeWidth,
  interactive,
  formatValue,
  pointCaption,
  eventMarkers,
  className,
}: SparkLineProps) {
  const gradId = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverXRatio, setHoverXRatio] = useState(0)

  const resolvedSeries = useMemo(
    () => buildSeries({ data, color, series, showArea }),
    [data, color, series, showArea],
  )
  const isChart = height >= 56 || showGrid
  const lineStroke = strokeWidth ?? (isChart ? 2 : 1.5)
  const isInteractive = interactive ?? isChart
  const fmt = formatValue ?? ((v: number) => formatChartTick(v))

  const { paths, lastPoints, gridY, pointCount, hoverRows } = useMemo(() => {
    const allValues = resolvedSeries.flatMap((s) => s.data).filter((n) => Number.isFinite(n))
    if (allValues.length < 2) {
      return {
        paths: [] as Array<{ linePath: string; areaPath: string; color: string }>,
        lastPoints: [] as Array<{ x: number; y: number; color: string }>,
        gridY: [] as number[],
        pointCount: 0,
        hoverRows: [] as Array<
          Array<{ label: string; value: number; color: string; yRatio: number; cy: number }>
        >,
      }
    }

    const autoMin = Math.min(...allValues)
    const autoMax = Math.max(...allValues)
    const minV = yMin ?? autoMin
    const maxV = yMax ?? autoMax
    const allZero = allValues.every((v) => v === 0)

    const padX = isChart ? 8 : 4
    const padY = isChart ? 8 : 4
    const innerW = width - 2 * padX
    const innerH = height - 2 * padY

    const scaleY = (v: number) => {
      if (allZero && minV === 0 && maxV === 0) return height - padY
      if (maxV === minV) return height / 2
      const t = (v - minV) / (maxV - minV)
      return height - padY - t * innerH
    }

    const gridY: number[] = []
    if (showGrid && gridLines >= 2) {
      for (let i = 0; i < gridLines; i++) {
        const t = i / (gridLines - 1)
        gridY.push(padY + t * innerH)
      }
    }

    const pointCount = Math.max(...resolvedSeries.map((s) => s.data.length))

    const paths = resolvedSeries.map((s) => {
      const values = s.data.filter((n) => Number.isFinite(n))
      const points = values.map((v, i) => ({
        x: padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
        y: scaleY(v),
      }))
      const linePath = catmullRomPath(points)
      const last = points[points.length - 1]
      const areaPath =
        linePath && s.showArea !== false && (s.showArea || showArea)
          ? `${linePath} L ${last.x} ${height - padY} L ${points[0].x} ${height - padY} Z`
          : ''
      return { linePath, areaPath, color: s.color }
    })

    const lastPoints = resolvedSeries.map((s) => {
      const values = s.data.filter((n) => Number.isFinite(n))
      const points = values.map((v, i) => ({
        x:
          padX +
          (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
        y: scaleY(v),
      }))
      const last = points[points.length - 1]
      return last ? { ...last, color: s.color } : null
    })

    const hoverRows: Array<
      Array<{ label: string; value: number; color: string; yRatio: number; cy: number }>
    > = []
    for (let i = 0; i < pointCount; i++) {
      const row: Array<{ label: string; value: number; color: string; yRatio: number; cy: number }> =
        []
      resolvedSeries.forEach((s, si) => {
        const v = s.data[i]
        if (!Number.isFinite(v)) return
        const y = scaleY(v)
        const yRatio = (y - padY) / innerH
        row.push({
          label: s.label ?? (resolvedSeries.length > 1 ? `Series ${si + 1}` : 'Value'),
          value: v,
          color: s.color,
          yRatio: Math.max(0, Math.min(1, yRatio)),
          cy: y,
        })
      })
      hoverRows.push(row)
    }

    return {
      paths,
      lastPoints: lastPoints.filter(Boolean) as Array<{
        x: number
        y: number
        color: string
      }>,
      gridY,
      pointCount,
      hoverRows,
    }
  }, [
    resolvedSeries,
    width,
    height,
    showGrid,
    gridLines,
    yMin,
    yMax,
    showArea,
    isChart,
  ])

  const handlePointer = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el || pointCount < 2) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const idx = Math.round(xRatio * (pointCount - 1))
      setHoverIndex(idx)
      setHoverXRatio(idx / Math.max(1, pointCount - 1))
    },
    [pointCount],
  )

  const clearHover = useCallback(() => {
    setHoverIndex(null)
  }, [])

  const hasData = resolvedSeries.some((s) => s.data.filter(Number.isFinite).length >= 2)
  if (!hasData || paths.length === 0 || !paths.some((p) => p.linePath)) {
    return null
  }

  const heightClass =
    className ??
    (height >= 100 ? 'h-[120px]' : height >= 56 ? 'h-16' : 'h-8')

  const activeRow = hoverIndex != null ? hoverRows[hoverIndex] : null
  const caption =
    hoverIndex != null && pointCaption
      ? pointCaption(hoverIndex, pointCount)
      : hoverIndex != null
        ? `#${hoverIndex + 1} / ${pointCount}`
        : null

  const tooltipLeftPct = hoverXRatio * 100
  const tooltipOnRight = hoverXRatio > 0.55

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClass}${isInteractive ? ' cursor-crosshair' : ''}`}
      onMouseMove={(e) => isInteractive && handlePointer(e.clientX)}
      onMouseLeave={clearHover}
      onTouchMove={(e) => {
        if (!isInteractive || e.touches.length === 0) return
        handlePointer(e.touches[0].clientX)
      }}
      onTouchEnd={clearHover}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full max-w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          {paths.map((p, i) =>
            p.areaPath ? (
              <linearGradient
                key={`g-${i}`}
                id={`${gradId}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={p.color} stopOpacity={0.22} />
                <stop offset="85%" stopColor={p.color} stopOpacity={0.04} />
                <stop offset="100%" stopColor={p.color} stopOpacity={0} />
              </linearGradient>
            ) : null,
          )}
        </defs>
        {gridY.map((y, i) => (
          <line
            key={`grid-${i}`}
            x1={0}
            x2={width}
            y1={y}
            y2={y}
            stroke="var(--c9-border)"
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {paths.map((p, i) =>
          p.areaPath ? (
            <path key={`a-${i}`} d={p.areaPath} fill={`url(#${gradId}-${i})`} stroke="none" />
          ) : null,
        )}
        {paths.map((p, i) =>
          p.linePath ? (
            <path
              key={`l-${i}`}
              d={p.linePath}
              fill="none"
              stroke={p.color}
              strokeWidth={lineStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
        {isInteractive && hoverIndex != null ? (
          <line
            x1={hoverXRatio * width}
            x2={hoverXRatio * width}
            y1={0}
            y2={height}
            stroke="var(--c9-text-muted)"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {isInteractive && activeRow
          ? activeRow.map((pt, i) => (
              <circle
                key={`h-${i}`}
                cx={hoverXRatio * width}
                cy={pt.cy}
                r={isChart ? 4 : 3}
                fill={pt.color}
                stroke="var(--c9-bg-card)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        {showDot
          ? lastPoints.map((pt, i) => (
              <circle key={`dot-${i}`} cx={pt.x} cy={pt.y} r={isChart ? 3.5 : 3} fill={pt.color}>
                <animate
                  attributeName="opacity"
                  values="0.45;1;0.45"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
            ))
          : null}
        {eventMarkers?.map((m, i) => {
          const padX = isChart ? 8 : 4
          const innerW = width - 2 * padX
          const x = padX + Math.max(0, Math.min(1, m.xRatio)) * innerW
          return (
            <line
              key={`m-${i}`}
              x1={x}
              x2={x}
              y1={height - 2}
              y2={height - (isChart ? 10 : 6)}
              stroke={markerColor(m.type)}
              strokeWidth={2}
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      {isInteractive && activeRow && hoverIndex != null ? (
        <div
          className="pointer-events-none absolute z-20 min-w-[7rem] rounded-md border border-[var(--c9-border-strong)] bg-[var(--c9-bg-card)]/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
          style={{
            top: 4,
            left: tooltipOnRight ? undefined : `${tooltipLeftPct}%`,
            right: tooltipOnRight ? `${100 - tooltipLeftPct}%` : undefined,
            transform: tooltipOnRight ? 'translateX(8px)' : 'translateX(-8px) translateX(-100%)',
          }}
        >
          {caption ? (
            <p className="mb-1 text-[9px] uppercase tracking-wider text-[var(--c9-text-disabled)]">
              {caption}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {activeRow.map((pt) => (
              <div
                key={pt.label}
                className="flex items-center justify-between gap-3 text-[10px]"
              >
                <span className="inline-flex items-center gap-1 text-[var(--c9-text-muted)]">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: pt.color }}
                  />
                  {pt.label}
                </span>
                <span className="font-mono font-semibold text-[var(--c9-text)]">
                  {fmt(pt.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
