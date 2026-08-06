import type { ReactNode } from 'react'
import {
  fmtBytes,
  fmtCpuMilliCores,
  fmtMemMB,
  fmtPct,
} from '../lib/format'
import { compactPodName } from '../lib/replicaMetricsDisplay'
import {
  ALLOCATED_NOT_MEASURED_HELP,
  METRICS_API_FRESHNESS_HELP,
  TIER_C_WARMUP_HELP,
} from '../lib/metricHelp'
import { containerFreshnessHint } from '../lib/metricsFreshness'
import type { MetricsBucket, ResourceUsageSource } from '../editor-core/stores/metricsStore'
import type { RuntimeHealthSummary } from '../editor-core/domain/metricsUiContract'
import { MetricChart } from './MetricChart'
import { MetricHelpIcon } from './MetricHelpIcon'
import { InfoTooltip } from './InfoTooltip'

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
        label="Live (10s)"
      />
      <TogglePill
        active={view.timeframe === 'session'}
        onClick={() => onChange({ timeframe: 'session' })}
        label="Session (9m)"
      />
      <span className="ml-auto" />
      <TogglePill
        active={view.showGraphs}
        onClick={() => onChange({ showGraphs: !view.showGraphs })}
        label="Graphs"
      />
      <span className="w-full text-[9px] leading-snug text-gray-600">
        Totals use a rolling 9-minute Prometheus window. Graphs use the same series with
        freshness / playback hints when available.
      </span>
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
      <div className="flex items-center gap-1">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--c9-text)]">
          {title}
        </h4>
        <InfoTooltip text={subtitle} />
      </div>
      {children}
    </section>
  )
}

export function PedagogicalHint({
  children,
}: {
  children: ReactNode
  /** @deprecated Tone is unused; kept for call-site compatibility. */
  tone?: 'violet' | 'sky' | 'muted'
}) {
  return (
    <span className="text-[11px] leading-relaxed text-[var(--c9-muted)]">
      {children}
    </span>
  )
}

export function PedagogicalCaption({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] leading-snug text-[var(--c9-muted)]">{children}</p>
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
  'rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] p-2.5 shadow-none'

/** Shared shell for metric / chart cards in the docked inspector. */
export const METRIC_CARD_SHELL = chartClass

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
  if (!view.showGraphs) return null
  if (data.length < 2) {
    return (
      <div className={`${chartClass} text-[10px] text-gray-500`}>
        <div className="mb-1 text-[10px] font-medium text-gray-400">{title}</div>
        Collecting samples…
      </div>
    )
  }
  // Live and session both use MetricChart so inspector graphs keep Railway-like
  // visual quality (axes, area, hover) instead of a 24px micro-sparkline.
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

export function RuntimeHealthSection({
  runtimeHealth,
}: {
  runtimeHealth: RuntimeHealthSummary
}) {
  const { pods, unreadyCount, restarting } = runtimeHealth
  if (pods.length === 0) return null
  const readyCount = pods.filter((p) => p.ready).length
  const hasIssue = restarting || unreadyCount > 0

  return (
    <section className={`space-y-2 ${METRIC_CARD_SHELL}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4
          className={`text-[11px] font-bold uppercase tracking-wide ${
            hasIssue ? 'text-red-400' : 'text-[var(--c9-text)]'
          }`}
        >
          Pod status
        </h4>
        <span className="font-mono text-[10px] text-[var(--c9-muted)]">
          Ready {readyCount}/{pods.length}
          {restarting ? ' · restarting' : ''}
          {unreadyCount > 0 ? ` · ${unreadyCount} not ready` : ''}
        </span>
      </div>
      <ul className="min-w-0 space-y-1.5 font-mono text-[10px] text-[var(--c9-text)]">
        {pods.map((pod) => {
          const detail = [
            pod.ready ? 'ready' : 'not ready',
            pod.restartCount > 0 ? `${pod.restartCount} restarts` : '',
            pod.lastTerminationReason ?? '',
            pod.waitingReason ?? '',
            pod.exitCode != null && pod.exitCode !== 0 ? `exit ${pod.exitCode}` : '',
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={pod.name} className="min-w-0">
              <span
                className={`block truncate ${pod.ready ? 'text-gray-400' : 'text-red-300'}`}
                title={pod.name}
              >
                {compactPodName(pod.name) || pod.name}
              </span>
              <span className="block text-gray-500">{detail}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ReplicaFlatList({
  rows,
}: {
  rows: Array<{
    name: string
    primaryText?: string
    rps?: number
    p99Ms: number
    cpuPct?: number
    memPct?: number
    warn?: boolean
    hot?: boolean
  }>
}) {
  if (rows.length === 0) return null
  return (
    <ul className="min-w-0 space-y-2 font-mono text-[10px] text-gray-300">
      {rows.map((row) => (
        <li key={row.name} className="min-w-0 space-y-0.5">
          <span className="block truncate text-gray-500" title={row.name}>
            {compactPodName(row.name) || row.name}
          </span>
          <span className="block text-gray-400">
            {row.hot ? '🔥 ' : row.warn ? '⚠️ ' : ''}
            {row.primaryText ?? `${Math.round(row.rps ?? 0)} rps`}
            {' · '}
            p99 {Math.round(row.p99Ms)}ms
            {row.cpuPct != null ? ` · CPU ${Math.round(row.cpuPct)}%` : ''}
            {row.memPct != null ? ` · Mem ${Math.round(row.memPct)}%` : ''}
          </span>
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

export function resourceFreshnessSuffix(_source: ResourceUsageSource | undefined): string {
  return ''
}

export function resourceUsageHelp(m: MetricsBucket): string | undefined {
  const tier = m.freshness?.containerCpu?.tier
  if (tier === 'estimated' || (!m.freshness && m.cpuIsEstimated)) {
    return ALLOCATED_NOT_MEASURED_HELP
  }
  if (tier === 'metrics_api') {
    return containerFreshnessHint(m.freshness?.containerCpu)
  }
  // Legacy sessions without freshness map.
  if (m.cpuIsEstimated) return ALLOCATED_NOT_MEASURED_HELP
  if (m.cpuSource === 'metrics_api' || m.memSource === 'metrics_api') {
    return METRICS_API_FRESHNESS_HELP
  }
  return undefined
}

/** Hover help for memory tiles — utilization % only (bytes stay in the value). */
export function memoryUsageHelp(m: MetricsBucket, memPercent: number): string | undefined {
  const tier = m.freshness?.containerMem?.tier
  if (tier === 'estimated' || (!m.freshness && m.memIsEstimated)) {
    return ALLOCATED_NOT_MEASURED_HELP
  }
  if (tier === 'metrics_api') {
    return containerFreshnessHint(m.freshness?.containerMem)
  }
  if (m.memIsEstimated) return ALLOCATED_NOT_MEASURED_HELP
  if (m.memoryLimit > 0) return fmtPct(memPercent)
  return undefined
}

/** Tier C = Kubernetes Metrics API (kubectl top), typical on GKE Autopilot DB/LB/MQ. */
export const TIER_C_WARMUP_MS = 60_000

export function isTierCResource(m: MetricsBucket): boolean {
  return (
    m.freshness?.containerCpu?.tier === 'metrics_api' ||
    m.freshness?.containerMem?.tier === 'metrics_api' ||
    m.cpuSource === 'metrics_api' ||
    m.memSource === 'metrics_api'
  )
}

export function isTierCWarmingUp(
  firstTierCAtMs: number | null,
  nowMs: number,
): boolean {
  if (firstTierCAtMs == null) return false
  return nowMs - firstTierCAtMs < TIER_C_WARMUP_MS
}

export function shouldShowDbClusterUtilizationCharts(
  m: MetricsBucket,
  warmingUp: boolean,
): boolean {
  if (m.cpuIsEstimated) return false
  if (warmingUp && isTierCResource(m)) return false
  return true
}

export function dbClusterResourceHelp(
  m: MetricsBucket,
  warmingUp: boolean,
): string | undefined {
  if (m.freshness?.containerCpu?.tier === 'estimated' || m.cpuIsEstimated) {
    return ALLOCATED_NOT_MEASURED_HELP
  }
  if (warmingUp && isTierCResource(m)) return TIER_C_WARMUP_HELP
  return resourceUsageHelp(m)
}

export function formatDbClusterResourceLabels(
  m: MetricsBucket,
  cpuPercent: number,
  memPercent: number,
  warmingUp: boolean,
): { cpu: string; mem: string } {
  if (m.cpuIsEstimated || m.memIsEstimated) {
    return formatResourceLabels(m, cpuPercent, memPercent)
  }
  if (warmingUp && isTierCResource(m)) {
    const cpuLimit =
      m.cpuLimit > 0 ? fmtCpuMilliCores(m.cpuLimit) : fmtCpuMilliCores(m.cpuUsage)
    const memLimit =
      m.memoryLimit > 0 ? fmtMemMB(m.memoryLimit) : fmtMemMB(m.memoryBytes)
    return {
      cpu: `Warming up · Limit ${cpuLimit}`,
      mem: `Warming up · Limit ${memLimit}`,
    }
  }
  return formatResourceLabels(m, cpuPercent, memPercent)
}

export function formatResourceLabels(
  m: MetricsBucket,
  cpuPercent: number,
  memPercent: number,
): { cpu: string; mem: string } {
  const cpu = m.cpuIsEstimated
    ? m.cpuLimit > 0
      ? `Limit ${fmtCpuMilliCores(m.cpuLimit)}`
      : `Limit ${fmtCpuMilliCores(m.cpuUsage)}`
    : `${fmtPct(cpuPercent)}${resourceFreshnessSuffix(m.cpuSource)}`
  const mem = m.memIsEstimated
    ? m.memoryLimit > 0
      ? `Limit ${fmtMemMB(m.memoryLimit)}`
      : `Limit ${fmtMemMB(m.memoryBytes)}`
    : `${fmtBytes(m.memoryBytes)}${
        m.memoryLimit > 0 ? ` · ${fmtPct(memPercent)}` : ''
      }${resourceFreshnessSuffix(m.memSource)}`
  return { cpu, mem }
}

/** Compact memory label for the canvas node tooltip (percent only when live). */
export function tooltipMemoryDisplay(
  m: MetricsBucket,
  memPercent: number,
  memLabel: string,
  warmingUp = false,
): string {
  if (m.memIsEstimated || warmingUp || m.memoryLimit <= 0) return memLabel
  return fmtPct(memPercent)
}
