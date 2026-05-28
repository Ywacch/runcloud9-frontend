import { useId, useMemo } from 'react'

export interface SparkLineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  showDot?: boolean
  showArea?: boolean
  /** Normalized 0–1 positions along the X axis (e.g. event tick marks). */
  eventMarkers?: Array<{ xRatio: number; type?: string }>
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

export function SparkLine({
  data,
  color = 'var(--c9-text-muted)',
  width = 120,
  height = 32,
  showDot = false,
  showArea = false,
  eventMarkers,
}: SparkLineProps) {
  const gradId = useId().replace(/:/g, '')

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    const values = data.filter((n) => Number.isFinite(n))
    if (values.length < 2) {
      return { linePath: '', areaPath: '', lastPoint: null as null | { x: number; y: number } }
    }

    const padX = 4
    const padY = 4
    const innerW = width - 2 * padX
    const innerH = height - 2 * padY
    const minV = Math.min(...values)
    const maxV = Math.max(...values)
    const allZero = values.every((v) => v === 0)

    const scaleY = (v: number) => {
      if (allZero) return height - padY
      if (maxV === minV) return height / 2
      const t = (v - minV) / (maxV - minV)
      return height - padY - t * innerH
    }

    const points = values.map((v, i) => ({
      x: padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
      y: scaleY(v),
    }))

    const linePath = catmullRomPath(points)
    const last = points[points.length - 1]
    const areaPath =
      linePath &&
      `${linePath} L ${last.x} ${height - padY} L ${points[0].x} ${height - padY} Z`

    return { linePath, areaPath, lastPoint: last }
  }, [data, width, height])

  if (data.filter((n) => Number.isFinite(n)).length < 2) {
    return null
  }

  if (!linePath) return null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-full max-w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {showArea ? (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        ) : null}
      </defs>
      {showArea && areaPath ? (
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot && lastPoint ? (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={color}>
          <animate
            attributeName="opacity"
            values="0.5;1;0.5"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      ) : null}
      {eventMarkers?.map((m, i) => {
        const padX = 4
        const innerW = width - 2 * padX
        const x = padX + Math.max(0, Math.min(1, m.xRatio)) * innerW
        return (
          <line
            key={`m-${i}`}
            x1={x}
            x2={x}
            y1={height - 2}
            y2={height - 6}
            stroke={markerColor(m.type)}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
