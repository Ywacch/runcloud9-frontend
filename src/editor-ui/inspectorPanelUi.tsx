import type { ReactNode } from 'react'
import {
  fmtBytes,
  fmtCpuMilliCores,
  fmtMemMB,
  fmtPct,
} from '../lib/format'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { SparkLine } from './SparkLine'
import { MetricChart } from './MetricChart'
import { MetricHelpIcon } from './MetricHelpIcon'

export type MetricsTimeframe = 'live' | 'session'

export interface PanelViewState {
  timeframe: MetricsTimeframe
  showGraphs: boolean
}

export function PanelViewControls({
  view,
  onChange,
}: {
  view: PanelViewState
  onChange: (patch: Partial<PanelViewState>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-800/80 pb-2 text-[10px] text-gray-500">
      <span className="font-semibold uppercase tracking-wider text-gray-600">Timeframe:</span>
      <TogglePill
        active={view.timeframe === 'live'}
        onClick={() => onChange({ timeframe: 'live' })}
        label="Live (30s)"
      />
      <TogglePill
        active={view.timeframe === 'session'}
        onClick={() => onChange({ timeframe: 'session' })}
        label="Full Session"
      />
      <span className="text-gray-700">|</span>
      <span className="font-semibold uppercase tracking-wider text-gray-600">Graphs:</span>
      <TogglePill
        active={view.showGraphs}
        onClick={() => onChange({ showGraphs: true })}
        label="ON"
      />
      <TogglePill
        active={!view.showGraphs}
        onClick={() => onChange({ showGraphs: false })}
        label="OFF"
      />
    </div>
  )
}

function TogglePill({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
        active
          ? 'bg-gray-700/80 text-gray-100'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {active ? '◉' : '○'} {label}
    </button>
  )
}

export function PedagogicalSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-200">
          ▼ {title}
        </h4>
        <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

export function PedagogicalHint({
  children,
  tone = 'violet',
}: {
  children: ReactNode
  tone?: 'violet' | 'sky' | 'muted'
}) {
  const toneClass =
    tone === 'sky'
      ? 'text-sky-300/90'
      : tone === 'muted'
        ? 'text-gray-500'
        : 'text-violet-300/90'
  return (
    <p className={`text-[10px] leading-relaxed ${toneClass}`}>
      <span className="mr-1">↳ 💡</span>
      {children}
    </p>
  )
}

export function PedagogicalCaption({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] leading-snug text-gray-500">
      <span className="mr-1">↳ 💬</span>
      {children}
    </p>
  )
}

export function StatBlock({
  label,
  value,
  help,
  graph,
}: {
  label: string
  value: string
  help?: string
  graph?: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        {help ? <MetricHelpIcon title={help} /> : null}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-white">{value}</div>
      {graph}
    </div>
  )
}

export function StatRow({
  left,
  right,
}: {
  left: ReactNode
  right?: ReactNode
}) {
  return (
    <div className={`grid gap-4 ${right ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {left}
      {right}
    </div>
  )
}

export function CapacityBar({
  pct,
  warnAt = 75,
  criticalAt = 90,
}: {
  pct: number
  warnAt?: number
  criticalAt?: number
}) {
  const clamped = Math.min(100, Math.max(0, pct))
  const barClass =
    clamped >= criticalAt
      ? 'bg-red-500'
      : clamped >= warnAt
        ? 'bg-amber-500'
        : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-gray-400">{clamped.toFixed(0)}%</span>
    </div>
  )
}

const chartClass =
  'rounded-lg border border-gray-700/40 bg-[var(--c9-bg-card)]/70 p-2 shadow-none'

export function MetricSeriesGraph({
  data,
  color,
  title,
  unit,
  view,
  showPlaybackDelay = false,
}: {
  data: number[]
  color: string
  title: string
  unit: string
  view: PanelViewState
  showPlaybackDelay?: boolean
}) {
  if (!view.showGraphs || data.length < 2) return null
  if (view.timeframe === 'live') {
    return (
      <SparkLine
        data={data}
        color={color}
        height={24}
        width={120}
        showArea
        className="h-6 max-w-[8rem]"
      />
    )
  }
  return (
    <MetricChart
      title={title}
      unit={unit}
      showPlaybackDelay={showPlaybackDelay}
      series={[{ data, color, showArea: true }]}
      compact
      className={chartClass}
    />
  )
}

export function EngineDiagnosticsBlock({
  cpuLabel,
  memLabel,
}: {
  cpuLabel: string
  memLabel: string
}) {
  return (
    <div className="space-y-1 font-mono text-[11px] text-gray-300">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>CPU: {cpuLabel}</span>
        <span>Memory: {memLabel}</span>
      </div>
    </div>
  )
}

export function ReplicaFlatList({
  rows,
}: {
  rows: Array<{
    name: string
    rps: number
    p99Ms: number
    cpuPct?: number
    warn?: boolean
    hot?: boolean
  }>
}) {
  if (rows.length === 0) return null
  return (
    <ul className="space-y-1 font-mono text-[10px] text-gray-300">
      {rows.map((row) => (
        <li key={row.name} className="flex flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 flex-1 truncate text-gray-500" title={row.name}>
            {row.name}
          </span>
          <span className="shrink-0 text-gray-400">{'·'.repeat(3)}</span>
          <span className="shrink-0">
            {row.hot ? '🔥 ' : row.warn ? '⚠️ ' : ''}
            {Math.round(row.rps)} rps
          </span>
          <span className="shrink-0 text-gray-500">| p99 {Math.round(row.p99Ms)}ms</span>
          {row.cpuPct != null ? (
            <span className="shrink-0 text-gray-500">| CPU {Math.round(row.cpuPct)}%</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function podDistributionSkew(
  rates: number[],
  threshold = 5,
): { skewed: boolean; max: number; min: number } {
  if (rates.length < 2) return { skewed: false, max: 0, min: 0 }
  const max = Math.max(...rates)
  const min = Math.min(...rates)
  return { skewed: max - min > threshold, max, min }
}

export function formatResourceLabels(
  m: MetricsBucket,
  cpuPercent: number,
  memPercent: number,
): { cpu: string; mem: string } {
  const cpu = m.cpuIsEstimated
    ? m.cpuLimit > 0
      ? `${fmtCpuMilliCores(m.cpuLimit)} alloc`
      : `${fmtCpuMilliCores(m.cpuUsage)} alloc`
    : fmtPct(cpuPercent)
  const mem = m.memIsEstimated
    ? m.memoryLimit > 0
      ? `${fmtMemMB(m.memoryLimit)} alloc`
      : `${fmtMemMB(m.memoryBytes)} alloc`
    : `${fmtBytes(m.memoryBytes)}${
        m.memoryLimit > 0 ? ` · ${fmtPct(memPercent)}` : ''
      }`
  return { cpu, mem }
}
