import type { ReactNode } from 'react'
import { fmtMs } from '../lib/format'
import type { LatencyQuantile } from '../lib/latencyQuantile'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function stacklabTracePath(
  data: number[],
  width = 360,
  height = 52,
  paddingBottom = 12,
  scaleMax?: number,
): string {
  if (data.length < 2) return ''
  const max = scaleMax != null && scaleMax > 0 ? scaleMax : Math.max(...data, 1)
  let d = ''
  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - paddingBottom - (value / max) * (height - paddingBottom - 4)
    d += index === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return d
}

/** SVG coordinates for one sample on a trace (shared scale for overlaid series). */
export function stacklabSeriesPoint(
  data: number[],
  index: number,
  width = 360,
  height = 52,
  paddingBottom = 12,
  scaleMax?: number,
): { x: number; y: number } | null {
  if (data.length < 2 || index < 0 || index >= data.length) return null
  const max =
    scaleMax != null && scaleMax > 0 ? scaleMax : Math.max(...data, 1)
  const x = (index / (data.length - 1)) * width
  const y =
    height -
    paddingBottom -
    (data[index] / max) * (height - paddingBottom - 4)
  return { x, y }
}

export function stacklabSparkPoints(data: number[], width = 100, height = 24): string {
  if (data.length < 2) return ''
  const max = Math.max(...data, 1)
  return data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - (value / max) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function StacklabSparkline({
  data,
  className = 'spark graph',
}: {
  data: number[]
  className?: string
}) {
  if (data.length < 2) return null
  const points = stacklabSparkPoints(data)
  return (
    <svg className={className} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1="22" x2="100" y2="22" className="spark" />
      <polyline points={points} />
    </svg>
  )
}

export function StacklabGraphsOffNote() {
  return (
    <div className="graphs-off graph">
      <b>GRAPHS OFF</b> — numbers only. Traces and markers resume when graphs come back on.
    </div>
  )
}

export function StacklabLatencyHistogram({
  p50Ms,
  p95Ms,
  p99Ms,
  selectedQuantile = 'p99',
  sampleLabel = 'last 10s',
}: {
  p50Ms?: number
  p95Ms?: number
  p99Ms?: number
  selectedQuantile?: LatencyQuantile
  sampleLabel?: string
}) {
  const p50 = p50Ms ?? 0
  const p95 = p95Ms ?? 0
  const p99 = p99Ms ?? 0
  if (p50 <= 0 && p95 <= 0 && p99 <= 0) return null

  const ref = selectedQuantile === 'p50' ? p50 : selectedQuantile === 'p95' ? p95 : p99
  const W = 360
  const H = 66
  const PB = 14
  const xmax = Math.max(5, ref * 1.35)
  const mu = Math.log(Math.max(0.5, p50))
  const s = 0.6
  const raw: number[] = []
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * xmax
    raw.push(
      x < 1 ? 0 : Math.exp(-Math.pow(Math.log(x) - mu, 2) / (2 * s * s)) / x,
    )
  }
  const vm = Math.max(...raw, 1)
  let d = ''
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * W
    const y = H - PB - (raw[i] / vm) * (H - PB - 6)
    d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`
  }

  const markers: Array<[LatencyQuantile, number]> = [
    ['p50', p50],
    ['p95', p95],
    ['p99', p99],
  ]

  return (
    <div className="graph-wrap graph">
      <div className="graph-head">
        <span className="lab">Latency distribution</span>
        <span className="lab">{sampleLabel}</span>
      </div>
      <div className="graph-box">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <path className="hist-fill" d={`${d} L${W} ${H - PB} L0 ${H - PB} Z`} />
          <path className="hist-line" d={d} />
          <line className="axis" x1="0" y1={H - PB} x2={W} y2={H - PB} />
          {markers.map(([pct, ms]) => {
            if (ms <= 0) return null
            const x = clamp((ms / xmax) * W, 4, W - 4)
            const on = pct === selectedQuantile
            const near = x > W - 46
            return (
              <g key={pct}>
                <line
                  className={`mk${on ? ' on' : ''}`}
                  x1={x}
                  y1={1}
                  x2={x}
                  y2={H - PB}
                />
                <rect
                  className="mk-sq"
                  x={x - 1.8}
                  y={1}
                  width={3.6}
                  height={3.6}
                  opacity={on ? 1 : 0.5}
                />
                <text
                  className={`mk-lab${on ? ' on' : ''}`}
                  x={near ? x - 4 : x + 4}
                  y={H - 4}
                  textAnchor={near ? 'end' : 'start'}
                >
                  {pct} {fmtMs(ms)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export function StacklabLatencyLegend({
  p50Ms,
  p95Ms,
  p99Ms,
  selectedQuantile = 'p99',
  onSelectQuantile,
}: {
  p50Ms?: number
  p95Ms?: number
  p99Ms?: number
  selectedQuantile?: LatencyQuantile
  onSelectQuantile?: (q: LatencyQuantile) => void
}) {
  const items: Array<[LatencyQuantile, number | undefined]> = [
    ['p50', p50Ms],
    ['p95', p95Ms],
    ['p99', p99Ms],
  ]

  return (
    <div className="legend">
      {items.map(([pct, ms]) => {
        if (ms == null || ms <= 0) return null
        const on = pct === selectedQuantile
        const body = (
          <>
            <span className="k" />
            {pct} <b>{fmtMs(ms)}</b>
            {on && pct === 'p99' ? (
              <span className="linkmark" style={{ color: 'var(--ink-3)' }}>
                <s />
                <i />
                <s />
              </span>
            ) : null}
          </>
        )
        if (onSelectQuantile) {
          return (
            <button
              key={pct}
              type="button"
              className={`lg${on ? ' is-on' : ''}`}
              onClick={() => onSelectQuantile(pct)}
            >
              {body}
            </button>
          )
        }
        return (
          <span key={pct} className={`lg${on ? ' is-on' : ''}`}>
            {body}
          </span>
        )
      })}
    </div>
  )
}

export function StacklabErrorRow({
  value,
  subtitle,
}: {
  value: string
  subtitle?: string
}) {
  const numeric = Number.parseFloat(value.replace('%', ''))
  const flag =
    Number.isFinite(numeric) && numeric >= 1
      ? 'red'
      : Number.isFinite(numeric) && numeric >= 0.25
        ? 'amber'
        : null

  return (
    <div className="row">
      <div className="row-key">
        <div className="t">Error rate</div>
        <div className="s">
          {subtitle ?? '5xx + timeouts · 5 s window · amber ≥ 0.25% · red ≥ 1.0%'}
        </div>
      </div>
      <div className={`row-v num${flag === 'amber' ? ' is-amber' : ''}`}>
        {value}
      </div>
      {flag ? (
        <div className={`flag ${flag}`}>{flag === 'red' ? 'CRITICAL' : 'ABOVE TARGET'}</div>
      ) : null}
    </div>
  )
}

export function StacklabNote({
  mark,
  children,
}: {
  mark: string
  children: ReactNode
}) {
  return (
    <p className="note">
      <b>{mark}</b>
      {children}
    </p>
  )
}
