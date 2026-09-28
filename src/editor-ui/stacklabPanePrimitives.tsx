import { useState, type ReactNode } from 'react'
import { fmtRate } from '../lib/format'
import { LatencyQuantileLabel } from './LatencyQuantileLabel'
import type { LatencyQuantile } from '../lib/latencyQuantile'
import type { MetricsTimeframe } from '../lib/metricTimeframe'
import {
  StacklabGraphsOffNote,
  StacklabLatencyHistogram,
  StacklabLatencyLegend,
  StacklabNote,
  StacklabSparkline,
  stacklabSeriesPoint,
  stacklabTracePath,
} from './stacklabMetricsUi'

export function SlPaneSection({ children }: { children: ReactNode }) {
  return <section className="sec">{children}</section>
}

export function SlSecHead({
  index,
  title,
  subtitle,
  tip,
}: {
  index: string
  title: string
  subtitle?: string
  tip?: string
}) {
  return (
    <div className="sec-head">
      <span className="sec-idx">{index}</span>
      <div>
        <h2 className={tip ? 'has-tip' : undefined} data-tip={tip}>
          {title}
        </h2>
        {subtitle ? <p className="sec-sub">{subtitle}</p> : null}
      </div>
    </div>
  )
}

export function SlSpacer() {
  return <div className="sl-spacer" style={{ height: 14 }} />
}

export function SlIdentLine({ children }: { children: ReactNode }) {
  return <div className="ident-line">{children}</div>
}

export function SlTiles({
  triad,
  children,
}: {
  triad?: boolean
  children: ReactNode
}) {
  return <div className={triad ? 'tiles triad' : 'tiles'}>{children}</div>
}

export function SlTile({ children }: { children: ReactNode }) {
  return <div className="tile">{children}</div>
}

export function SlTileLab({ children }: { children: ReactNode }) {
  return <div className="tile-lab">{children}</div>
}

export function SlTileVal({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'amber' | 'green' | 'red'
}) {
  const cls = ['tile-v', 'num', tone ? `is-${tone}` : ''].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}

export function SlTileFoot({
  graph,
  left,
  right,
  children,
}: {
  graph?: boolean
  left?: ReactNode
  right?: ReactNode
  children?: ReactNode
}) {
  if (children) return <div className="tile-foot">{children}</div>
  return (
    <div className={`tile-foot${graph ? ' graph' : ''}`}>
      {left != null ? <span>{left}</span> : null}
      {right != null ? <span>{right}</span> : null}
    </div>
  )
}

export function SlUnit({ children }: { children: ReactNode }) {
  return <span className="u">{children}</span>
}

export function SlLatencyTileLab({
  quantile,
  timeframe,
  sessionAvailable,
  onChange,
}: {
  quantile: LatencyQuantile
  timeframe: MetricsTimeframe
  sessionAvailable: (q: LatencyQuantile) => boolean
  onChange?: (q: LatencyQuantile) => void
}) {
  return (
    <SlTileLab>
      <LatencyQuantileLabel
        quantile={quantile}
        timeframe={timeframe}
        sessionAvailable={sessionAvailable}
        onChange={onChange}
      />
    </SlTileLab>
  )
}

export function SlHint({
  direction,
  children,
  onClick,
}: {
  direction: 'forward' | 'back'
  children: ReactNode
  onClick?: () => void
}) {
  const arrow = direction === 'forward' ? '→' : '←'
  return (
    <button
      type="button"
      className={`hint${direction === 'back' ? ' is-top' : ''}`}
      onClick={onClick}
    >
      <span className="hint-mark">{arrow}</span>
      <span className="hint-txt">{children}</span>
      <span className="hint-rule" />
      <span className="hint-arrow">{arrow}</span>
    </button>
  )
}

export function SlRow({
  title,
  subtitle,
  value,
  unit,
  flag,
  valueTone,
}: {
  title: string
  subtitle?: string
  value: ReactNode
  unit?: ReactNode
  flag?: { text: string; tone: 'amber' | 'green' | 'red' }
  valueTone?: 'amber' | 'green' | 'red'
}) {
  return (
    <div className="row">
      <div className="row-key">
        <div className="t">{title}</div>
        {subtitle ? <div className="s">{subtitle}</div> : null}
      </div>
      <div className={`row-v num${valueTone ? ` is-${valueTone}` : ''}`}>
        {value}
        {unit}
      </div>
      {flag ? <div className={`flag ${flag.tone}`}>{flag.text}</div> : null}
    </div>
  )
}

export function SlUtil({
  hot,
  children,
}: {
  hot?: boolean
  children: ReactNode
}) {
  return <div className={`util${hot ? ' is-hot' : ''}`}>{children}</div>
}

export function SlUtilTop({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: ReactNode
  unit?: string
  tone?: 'amber'
}) {
  return (
    <div className="util-top">
      <span className="util-lab">{label}</span>
      <span className={`util-v num${tone ? ` is-${tone}` : ''}`}>
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </span>
    </div>
  )
}

export function SlScale({
  pct,
  warnAt = 80,
  footLeft,
  footRight,
}: {
  pct: number
  warnAt?: number
  footLeft: string
  footRight: string
}) {
  const clamped = Math.min(100, Math.max(0, pct))
  const hot = clamped >= warnAt
  return (
    <>
      <div className="scale">
        <div className="scale-track">
          <div className={`scale-fill${hot ? ' amber' : ''}`} style={{ width: `${clamped}%` }} />
        </div>
        <div className="scale-ticks" />
        <div className="scale-warn" style={{ left: `${warnAt}%` }}>
          <span>{warnAt} warn</span>
        </div>
        <div className="scale-caret" style={{ left: `${clamped}%` }} />
      </div>
      <div className="scale-foot">
        <span>{footLeft}</span>
        <span>{footRight}</span>
      </div>
    </>
  )
}

export function SlUtilHelp({ children }: { children: ReactNode }) {
  return <div className="util-help">{children}</div>
}

export function SlGraphWrap({
  title,
  sub,
  height = 52,
  data,
  dashed,
  secondary,
  formatValue = fmtRate,
}: {
  title: string
  sub: string
  height?: number
  data: number[]
  dashed?: boolean
  /** Optional second series, drawn dashed on the same vertical scale. */
  secondary?: number[]
  primaryLabel?: string
  secondaryLabel?: string
  formatValue?: (value: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return null
  const W = 360
  const PB = 12
  const secondarySeries = secondary && secondary.length >= 2 ? secondary : null
  const scaleMax = Math.max(1, ...data, ...(secondarySeries ?? []))
  const primary = stacklabTracePath(data, W, height, PB, scaleMax)
  const secondaryPath = secondarySeries
    ? stacklabTracePath(secondarySeries, W, height, PB, scaleMax)
    : null
  const index = hover != null ? Math.min(data.length - 1, Math.max(0, hover)) : null
  const hoverX = index != null ? (index / (data.length - 1)) * 100 : null
  const primaryPt =
    index != null ? stacklabSeriesPoint(data, index, W, height, PB, scaleMax) : null
  const secondaryPt =
    index != null && secondarySeries
      ? stacklabSeriesPoint(
          secondarySeries,
          Math.min(index, secondarySeries.length - 1),
          W,
          height,
          PB,
          scaleMax,
        )
      : null
  const primaryValue = index != null ? formatValue(data[index]) : null
  const secondaryValue =
    index != null && secondarySeries
      ? formatValue(secondarySeries[Math.min(index, secondarySeries.length - 1)])
      : null
  return (
    <div className="graph-wrap graph">
      <div className="graph-head">
        <span className="lab">{title}</span>
        <span className="lab">{sub}</span>
      </div>
      <div
        className="graph-box"
        style={{ height }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          if (rect.width <= 0) return
          const ratio = (event.clientX - rect.left) / rect.width
          setHover(Math.round(ratio * (data.length - 1)))
        }}
        onMouseLeave={() => setHover(null)}
      >
        {hoverX != null && primaryValue != null ? (
          <div
            className="graph-tip"
            style={{ left: `${hoverX}%` }}
            role="tooltip"
            aria-hidden={false}
          >
            {secondaryValue != null ? (
              <>
                <span className="graph-tip-v is-primary">{primaryValue}</span>
                <span className="graph-tip-sep" aria-hidden>·</span>
                <span className="graph-tip-v is-secondary">{secondaryValue}</span>
              </>
            ) : (
              <span className="graph-tip-v is-primary">{primaryValue}</span>
            )}
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          aria-hidden
          style={{ pointerEvents: 'none' }}
        >
          <line className="axis" x1="0" y1={height - PB} x2={W} y2={height - PB} />
          {index != null ? (
            <line
              className="mk on"
              x1={(index / (data.length - 1)) * W}
              y1={0}
              x2={(index / (data.length - 1)) * W}
              y2={height - PB}
            />
          ) : null}
          <path className={`trace is-primary${dashed ? ' dash' : ''}`} d={primary} />
          {secondaryPath ? (
            <path className="trace dash is-secondary" d={secondaryPath} />
          ) : null}
          {primaryPt ? (
            <circle className="trace-dot is-primary" cx={primaryPt.x} cy={primaryPt.y} r={2.6} />
          ) : null}
          {secondaryPt ? (
            <circle
              className="trace-dot is-secondary"
              cx={secondaryPt.x}
              cy={secondaryPt.y}
              r={2.6}
            />
          ) : null}
        </svg>
      </div>
    </div>
  )
}

export function SlKvList({
  children,
  flush,
}: {
  children: ReactNode
  flush?: boolean
}) {
  return <div className={`kv-list${flush ? ' is-flush' : ''}`}>{children}</div>
}

export function SlKv({
  keyLabel,
  value,
  tone,
}: {
  keyLabel: string
  value: ReactNode
  tone?: string
}) {
  return (
    <div className="kv">
      <span className="k">{keyLabel}</span>
      <span className={`v${tone ? ` ${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export function SlPodStat({ children }: { children: ReactNode }) {
  return <p className="podstat">{children}</p>
}

export function SlPodStatus({
  ready,
  bad,
  warn,
}: {
  ready: string
  bad?: string
  warn?: string
}) {
  return (
    <SlPodStat>
      <span className="p">
        <span className="st ok" />
        {ready}
      </span>
      {bad ? (
        <>
          <span className="sep">·</span>
          <span className="p">
            <span className="st bad" />
            {bad}
          </span>
        </>
      ) : null}
      {warn ? (
        <>
          <span className="sep">·</span>
          <span className="p">
            <span className="st warn" />
            {warn}
          </span>
        </>
      ) : null}
    </SlPodStat>
  )
}

export type SlPodRow = {
  name: string
  rps: string
  latency?: string
  cpu: string
  mem: string
  cpuTone?: 'am'
  memTone?: 'am'
  selected?: boolean
  onSelect?: () => void
}

export function SlPodTable({
  columns,
  rows,
}: {
  columns: [string, string, string, string] | [string, string, string, string, string]
  rows: SlPodRow[]
}) {
  const withLatency = columns.length === 5
  return (
    <div className="pod-table">
      <div className={`pt h${withLatency ? ' lat' : ''}`}>
        <span>{columns[0]}</span>
        <span className="r">{columns[1]}</span>
        {withLatency ? <span className="r">{columns[2]}</span> : null}
        <span className="r">{columns[withLatency ? 3 : 2]}</span>
        <span className="r">{columns[withLatency ? 4 : 3]}</span>
      </div>
      {rows.map((row) => {
        const inner = (
          <>
            <span>
              <span className={`st ${row.selected ? 'ok' : 'ok'}`} />
              {row.name}
            </span>
            <span className="r throughput">{row.rps}</span>
            {withLatency ? <span className="r">{row.latency ?? '—'}</span> : null}
            <span className={`r${row.cpuTone ? ` ${row.cpuTone}` : ''}`}>{row.cpu}</span>
            <span className={`r${row.memTone ? ` ${row.memTone}` : ''}`}>{row.mem}</span>
          </>
        )
        if (row.onSelect) {
          return (
            <button
              key={row.name}
              type="button"
              className={`pt${withLatency ? ' lat' : ''} rowsel${row.selected ? ' is-on' : ''}`}
              aria-current={row.selected ? 'true' : undefined}
              onClick={row.onSelect}
            >
              {inner}
            </button>
          )
        }
        return (
          <div key={row.name} className={`pt${withLatency ? ' lat' : ''}`}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

export function SlCounter({
  label,
  tag,
  value,
  unit,
  bandData,
  cum,
}: {
  label: string
  tag?: string
  value: ReactNode
  unit?: string
  bandData?: number[]
  cum?: string
}) {
  return (
    <div className="counter">
      <div className="ct-head">
        <span className="ct-lab">{label}</span>
        {tag ? <span className="ct-tag">{tag}</span> : null}
      </div>
      <div className="ct-v num">
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </div>
      {bandData && bandData.length > 0 ? (
        <div className="band">
          {bandData.slice(-56).map((v, i) => (
            <i key={i} style={{ height: `${Math.round(v * 100)}%` }} />
          ))}
        </div>
      ) : (
        <div className="band" />
      )}
      {cum ? <div className="ct-cum">{cum}</div> : null}
    </div>
  )
}

export function SlGauge({
  label,
  value,
  unit,
  pct,
  cells = 24,
  hot,
  footLeft,
  footRight,
}: {
  label: string
  value: ReactNode
  unit?: string
  pct: number
  cells?: number
  hot?: boolean
  footLeft: string
  footRight: string
}) {
  const on = Math.round((Math.min(100, Math.max(0, pct)) / 100) * cells)
  return (
    <div className="gauge">
      <div className="gauge-top">
        <span className="lab">{label}</span>
        <span className={`gauge-v num${hot ? ' is-amber' : ''}`}>
          {value}
          {unit ? <span className="u">{unit}</span> : null}
        </span>
      </div>
      <div className={`bar${hot ? ' is-amber' : ''}`}>
        {Array.from({ length: cells }, (_, i) => (
          <i key={i} className={i < on ? 'f' : ''} />
        ))}
      </div>
      <div className="gauge-foot">
        <span>{footLeft}</span>
        <span>{footRight}</span>
      </div>
    </div>
  )
}

export function SlBarInline({
  pct,
  cells = 22,
  hot,
}: {
  pct: number
  cells?: number
  hot?: boolean
}) {
  const on = Math.round((Math.min(100, Math.max(0, pct)) / 100) * cells)
  return (
    <div className={`bar${hot ? ' is-amber' : ''}`} style={{ marginTop: 9 }}>
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} className={i < on ? 'f' : ''} />
      ))}
    </div>
  )
}

export function SlStatStrip({ children }: { children: ReactNode }) {
  return <div className="stat-strip">{children}</div>
}

export function SlStatCell({
  label,
  value,
  unit,
}: {
  label: string
  value: ReactNode
  unit?: string
}) {
  return (
    <div className="stat-cell">
      <div className="stat-lab">{label}</div>
      <div className="stat-v num">
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </div>
    </div>
  )
}

export function SlDisc({
  id,
  title,
  tag,
  body,
  open,
  onToggle,
}: {
  id: string
  title: string
  tag?: string
  body: ReactNode
  open?: boolean
  onToggle?: () => void
}) {
  return (
    <div className={`disc${open ? ' is-open' : ''}`} data-disc={id}>
      <button type="button" className="disc-head" onClick={onToggle}>
        <span className="plus" />
        <span className="disc-title">{title}</span>
        {tag ? <span className="disc-tag">{tag}</span> : null}
      </button>
      <div className="disc-body">{body}</div>
    </div>
  )
}

export function SlTrade({
  leftLabel,
  leftValue,
  leftUnit,
  leftSub,
  rightLabel,
  rightValue,
  rightUnit,
  rightSub,
  note,
}: {
  leftLabel: string
  leftValue: ReactNode
  leftUnit?: string
  leftSub: string
  rightLabel: string
  rightValue: ReactNode
  rightUnit?: string
  rightSub: string
  note: ReactNode
}) {
  return (
    <div className="trade">
      <div className="split">
        <div className="split-side">
          <div className="s-lab">{leftLabel}</div>
          <div className="s-v num">
            {leftValue}
            {leftUnit ? <span className="u">{leftUnit}</span> : null}
          </div>
          <div className="s-sub">{leftSub}</div>
        </div>
        <div className="split-mid">
          <span className="arw">→</span>
          <span className="mul">lag</span>
        </div>
        <div className="split-side">
          <div className="s-lab">{rightLabel}</div>
          <div className="s-v num">
            {rightValue}
            {rightUnit ? <span className="u">{rightUnit}</span> : null}
          </div>
          <div className="s-sub">{rightSub}</div>
        </div>
      </div>
      <div className="trade-note">{note}</div>
    </div>
  )
}

export type SlBeRow = {
  name: string
  rps: string
  cpu: string
  mem: string
  p99: string
  share: string
  status: 'ok' | 'warn' | 'bad'
  cpuTone?: 'am'
  memTone?: 'am'
}

export function SlBeList({
  rows,
  throughputCol = 'rps',
  latencyCol = 'p99',
}: {
  rows: SlBeRow[]
  throughputCol?: string
  latencyCol?: string
}) {
  return (
    <div className="be-list">
      <div className="be h">
        <span>backend</span>
        <span className="r">{throughputCol}</span>
        <span className="r">cpu</span>
        <span className="r">mem</span>
        <span className="r">{latencyCol}</span>
        <span className="r">share</span>
      </div>
      {rows.map((row) => (
        <div key={row.name} className="be">
          <span className="name">
            <span className={`st ${row.status}`} />
            {row.name}
          </span>
          <span className="r">{row.rps}</span>
          <span className={`r${row.cpuTone ? ` ${row.cpuTone}` : ''}`}>{row.cpu}</span>
          <span className={`r${row.memTone ? ` ${row.memTone}` : ''}`}>{row.mem}</span>
          <span className="r">{row.p99}</span>
          <span className="r">{row.share}</span>
        </div>
      ))}
    </div>
  )
}

export function SlRedHealthPane({
  index,
  title,
  subtitle,
  rateLabel,
  rateValue,
  rateUnit,
  rateSpark,
  ratePeak,
  latencyMs,
  quantile,
  timeframe,
  sessionAvailable,
  onQuantileChange,
  distP50,
  distP95,
  distP99,
  showGraphs,
  sampleLabel,
  errorDisplay,
  hintForward,
  onHintForwardClick,
  sessionCaveat,
}: {
  index: string
  title: string
  subtitle: string
  rateLabel: string
  rateValue: string
  rateUnit: string
  rateSpark: number[]
  ratePeak: number
  latencyMs: number
  quantile: LatencyQuantile
  timeframe: MetricsTimeframe
  sessionAvailable: (q: LatencyQuantile) => boolean
  onQuantileChange?: (q: LatencyQuantile) => void
  distP50: number
  distP95: number
  distP99: number
  showGraphs: boolean
  sampleLabel: string
  errorDisplay: string
  hintForward?: ReactNode
  onHintForwardClick?: () => void
  sessionCaveat?: ReactNode
}) {
  return (
    <>
      <SlSecHead index={index} title={title} subtitle={subtitle} />
      <SlTiles>
        <SlTile>
          <SlTileLab>{rateLabel}</SlTileLab>
          <SlTileVal>
            {rateValue}
            <SlUnit>{rateUnit}</SlUnit>
          </SlTileVal>
          {showGraphs ? <StacklabSparkline data={rateSpark} /> : null}
          {showGraphs ? (
            <SlTileFoot graph left="window 10s" right={`peak ${fmtRate(ratePeak)}`} />
          ) : null}
        </SlTile>
        <SlTile>
          <SlLatencyTileLab
            quantile={quantile}
            timeframe={timeframe}
            sessionAvailable={sessionAvailable}
            onChange={onQuantileChange}
          />
          <SlTileVal>
            {latencyMs > 0 ? Math.round(latencyMs) : '—'}
            <SlUnit>ms</SlUnit>
          </SlTileVal>
          <SlTileFoot left="this hop · 10s" right="" />
        </SlTile>
      </SlTiles>
      <StacklabNote mark="?">Latency percentiles for this hop (from the metrics stream).</StacklabNote>
      {showGraphs ? (
        <StacklabLatencyHistogram
          p50Ms={distP50}
          p95Ms={distP95}
          p99Ms={distP99}
          selectedQuantile={quantile}
          sampleLabel={sampleLabel}
        />
      ) : (
        <StacklabGraphsOffNote />
      )}
      <StacklabLatencyLegend
        p50Ms={distP50}
        p95Ms={distP95}
        p99Ms={distP99}
        selectedQuantile={quantile}
        onSelectQuantile={onQuantileChange}
      />
      <StacklabNote mark="↔">
        Canvas and the live session bar always show <em>p99</em>.
      </StacklabNote>
      {sessionCaveat}
      <SlRow
        title="Error rate"
        subtitle="5xx + timeouts · 5 s window · amber ≥ 0.25% · red ≥ 1.0%"
        value={errorDisplay}
        flag={
          parseErrorFlag(errorDisplay)
            ? { text: parseErrorFlag(errorDisplay)!.text, tone: parseErrorFlag(errorDisplay)!.tone }
            : undefined
        }
        valueTone={parseErrorFlag(errorDisplay)?.tone}
      />
      {hintForward ? (
        <SlHint direction="forward" onClick={onHintForwardClick}>{hintForward}</SlHint>
      ) : null}
    </>
  )
}

function parseErrorFlag(display: string): { text: string; tone: 'amber' | 'red' } | null {
  const n = Number.parseFloat(display.replace('%', ''))
  if (!Number.isFinite(n)) return null
  if (n >= 1) return { text: 'FAILING', tone: 'red' }
  if (n >= 0.25) return { text: 'ABOVE TARGET', tone: 'amber' }
  return null
}
