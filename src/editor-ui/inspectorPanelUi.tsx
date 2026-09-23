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
  SESSION_TIMEFRAME_FOOTER,
  TIER_C_WARMUP_HELP,
} from '../lib/metricHelp'
import { containerFreshnessHint } from '../lib/metricsFreshness'
import type { MetricsBucket, ResourceUsageSource } from '../editor-core/stores/metricsStore'
import type {
  ComponentLayerMetrics,
  PodRuntimeHealth,
  RuntimeHealthSummary,
} from '../editor-core/domain/metricsUiContract'
import type { SelectedInstanceId } from '../lib/dbInstanceScope'
import type { LatencyQuantile } from '../lib/latencyQuantile'
import { StacklabSparkline } from './stacklabMetricsUi'

export type MetricsTimeframe = 'live' | 'session'

export interface PanelViewState {
  timeframe: MetricsTimeframe
  showGraphs: boolean
  latencyQuantile: LatencyQuantile
}

/** Shared label style for inspector metric keys and section chrome. */
export const INSPECTOR_LABEL_CLASS =
  'font-mono text-[9px] font-medium uppercase tracking-[0.13em] text-[var(--c9-muted)]'

/** Config tab field stack (mock pcfg-field, indigo tokens). */
export const CONFIG_FIELD_CLASS = 'sl-field w-full'

export const CONFIG_LABEL_CLASS = 'sl-f-lab mb-2 block'

export const CONFIG_HELPER_CLASS = 'sl-f-sub mt-1.5'

export function stacklabNodeKind(type: string): string {
  switch (type) {
    case 'compute':
      return 'SERVICE'
    case 'load_balancer':
      return 'ROUTER'
    case 'client':
      return 'CLIENT'
    default:
      return 'NODE'
  }
}

export function InspectorSegmentGroup({
  children,
  className = '',
  'aria-label': ariaLabel,
  variant = 'stacklab',
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
  variant?: 'stacklab' | 'legacy'
}) {
  if (variant === 'legacy') {
    return (
      <div
        className={`inline-flex flex-wrap gap-0.5 rounded-none border border-[var(--c9-border)] bg-[var(--c9-bg)] p-0.5 ${className}`}
        role="group"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    )
  }
  return (
    <div className={`sl-seg ${className}`} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  )
}

export function InspectorSegment({
  active,
  onClick,
  label,
  className = '',
  variant = 'stacklab',
}: {
  active: boolean
  onClick: () => void
  label: string
  className?: string
  variant?: 'stacklab' | 'legacy'
}) {
  if (variant === 'legacy') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`rounded-none px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--c9-accent)] ${
          active
            ? 'bg-[var(--c9-bg-card)] text-[var(--c9-text)] shadow-[inset_0_1px_0_var(--c9-border-inset)]'
            : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
        } ${className}`}
      >
        {label}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${active ? 'is-on' : ''} ${className}`}
    >
      {label}
    </button>
  )
}

export function PanelViewControls({
  view,
  onChange,
  showScope = false,
  scopeValue = 'cluster',
  scopeOptions = ['cluster', 'instance'],
  onScopeChange,
  showTimeframe = true,
  showGraphsToggle = true,
}: {
  view: PanelViewState
  onChange: (patch: Partial<PanelViewState>) => void
  showScope?: boolean
  scopeValue?: string
  scopeOptions?: string[]
  onScopeChange?: (scope: string) => void
  showTimeframe?: boolean
  showGraphsToggle?: boolean
  showLatencyNote?: boolean
}) {
  if (!showTimeframe && !showGraphsToggle && !showScope) return null

  return (
    <div className="controls">
      <div className="ctl-row">
        {showScope ? (
          <div className="ctl">
            <span className="lab">scope</span>
            <div
              className={`seg${scopeOptions.length < 2 ? ' dim' : ''}`}
              role="group"
              aria-label="Metrics scope"
            >
              {scopeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={scopeValue === option ? 'is-on' : ''}
                  disabled={scopeOptions.length < 2}
                  onClick={() => onScopeChange?.(option)}
                >
                  {option === 'cluster' ? 'Cluster' : 'Instance'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {showTimeframe ? (
          <div className="ctl">
            <span className="lab">time</span>
            <div className="seg" role="group" aria-label="Metrics timeframe">
              <button
                type="button"
                className={view.timeframe === 'live' ? 'is-on' : ''}
                onClick={() => onChange({ timeframe: 'live' })}
              >
                Live
              </button>
              <button
                type="button"
                className={view.timeframe === 'session' ? 'is-on' : ''}
                onClick={() => onChange({ timeframe: 'session' })}
              >
                Session
              </button>
            </div>
          </div>
        ) : null}
        {showGraphsToggle ? (
          <div className="ctl">
            <button
              type="button"
              className={`flip ${view.showGraphs ? 'is-on' : ''}`}
              aria-pressed={view.showGraphs}
              aria-label="Toggle graphs"
              title="Toggle graphs"
              onClick={() => onChange({ showGraphs: !view.showGraphs })}
            >
              <span className="flip-track">
                <span className="flip-knob" />
              </span>
              <span className="flip-lab">graphs {view.showGraphs ? 'on' : 'off'}</span>
            </button>
          </div>
        ) : null}
      </div>
      {showTimeframe && view.timeframe === 'session' ? (
        <p className="ctl-foot is-on">{SESSION_TIMEFRAME_FOOTER}</p>
      ) : null}
    </div>
  )
}

export function PatternBridge({
  direction,
  children,
}: {
  direction: 'forward' | 'back'
  children: ReactNode
}) {
  const arrow = direction === 'forward' ? '→' : '←'
  return (
    <button type="button" className="hint" data-pattern-bridge={direction}>
      <span className="hint-mark">{arrow}</span>
      <span className="hint-txt">{children}</span>
      <span className="hint-rule" />
      <span className="hint-arrow">{arrow}</span>
    </button>
  )
}

export function ResourceUnitCaption({ m }: { m: MetricsBucket }) {
  if (m.cpuIsEstimated && m.memIsEstimated) return null
  const cpu =
    m.cpuLimit > 0
      ? `${fmtCpuMilliCores(m.cpuUsage)} / ${fmtCpuMilliCores(m.cpuLimit)}`
      : fmtCpuMilliCores(m.cpuUsage)
  const mem =
    m.memoryLimit > 0
      ? `${fmtMemMB(m.memoryBytes)} / ${fmtMemMB(m.memoryLimit)}`
      : fmtMemMB(m.memoryBytes)
  return (
    <p className="font-mono text-[9px] tabular-nums text-[var(--c9-text-disabled)]">
      CPU {cpu} · Mem {mem}
    </p>
  )
}

export function PedagogicalSection({
  index = '01',
  title,
  subtitle,
  children,
}: {
  index?: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="sec">
      <div className="sec-head">
        <span className="sec-idx">{index}</span>
        <div>
          <h2>{title}</h2>
          <p className="sec-sub">{subtitle}</p>
        </div>
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
  return <p className="note">{children}</p>
}

export function PedagogicalCaption({ children }: { children: ReactNode }) {
  return (
    <p className="note">
      <b>↔</b>
      {children}
    </p>
  )
}

export function StatBlock({
  label,
  labelNode,
  value,
  unit,
  sparkData,
  tileFoot,
  view,
  graph,
  valueClassName = '',
}: {
  label?: string
  labelNode?: ReactNode
  value: string
  unit?: string
  sparkData?: number[]
  tileFoot?: ReactNode
  view?: PanelViewState
  help?: string
  graph?: ReactNode
  valueClassName?: string
}) {
  const showSpark =
    view?.showGraphs !== false && sparkData != null && sparkData.length >= 2
  return (
    <div className="tile">
      <div className="tile-lab">{labelNode ?? label}</div>
      <div className={`tile-v num ${valueClassName}`.trim()}>
        <span>{value}</span>
        {unit ? <span className="u">{unit}</span> : null}
      </div>
      {showSpark ? <StacklabSparkline data={sparkData!} /> : null}
      {tileFoot}
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
  return <div className={right ? 'tiles' : 'tiles'} style={right ? undefined : { gridTemplateColumns: '1fr' }}>{left}{right}</div>
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
  const hot = clamped >= warnAt || clamped >= criticalAt
  return (
    <div className="scale">
      <div className="scale-track">
        <div
          className={`scale-fill${hot ? ' amber' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="scale-ticks" />
      <div className="scale-caret" style={{ left: `${clamped}%` }} />
    </div>
  )
}

const chartClass =
  'rounded-none border border-[var(--c9-border)] bg-[var(--c9-bg-card)] p-3'

/** Shared shell for metric / chart cards in the docked inspector. */
export const METRIC_CARD_SHELL = chartClass

export function MetricSeriesGraph({
  data,
  title,
  sub,
  unit,
  view,
  height = 52,
}: {
  data: number[]
  color?: string
  title: string
  unit?: string
  sub?: string
  view: PanelViewState
  showPlaybackDelay?: boolean
  height?: number
}) {
  const subLabel = sub ?? unit
  if (!view.showGraphs) return null
  if (data.length < 2) return null
  const W = 360
  const H = height
  const PB = 12
  const max = Math.max(...data, 1)
  let d = ''
  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * W
    const y = H - PB - (value / max) * (H - PB - 4)
    const prevY =
      index > 0
        ? H - PB - (data[index - 1] / max) * (H - PB - 4)
        : y
    d +=
      index === 0
        ? `M${x.toFixed(1)} ${y.toFixed(1)}`
        : ` L${x.toFixed(1)} ${prevY.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return (
    <div className="graph-wrap graph">
      <div className="graph-head">
        <span className="lab">{title}</span>
        {subLabel ? <span className="lab">{subLabel}</span> : null}
      </div>
      <div className="graph-box" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <line className="axis" x1="0" y1={H - PB} x2={W} y2={H - PB} />
          <path className="trace" d={d} />
        </svg>
      </div>
    </div>
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
    <div className="space-y-1 font-mono text-[11px] text-[var(--c9-text)]">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>CPU: {cpuLabel}</span>
        <span>Memory: {memLabel}</span>
      </div>
    </div>
  )
}

export function runtimeHealthPodsForScope(
  pods: PodRuntimeHealth[],
  instanceId?: SelectedInstanceId,
): PodRuntimeHealth[] | null {
  if (!instanceId || instanceId === 'cluster') return pods
  const filtered = pods.filter(
    (pod) => pod.name === instanceId || pod.name.includes(instanceId),
  )
  return filtered.length > 0 ? filtered : null
}

export function RuntimeHealthSection({
  runtimeHealth,
  instanceId,
}: {
  runtimeHealth: RuntimeHealthSummary
  instanceId?: SelectedInstanceId
}) {
  const { restarting } = runtimeHealth
  const pods = runtimeHealthPodsForScope(runtimeHealth.pods, instanceId)
  if (!pods || pods.length === 0) return null
  const readyCount = pods.filter((p) => p.ready).length
  const scopedUnready = pods.filter((p) => !p.ready).length
  const hasIssue = restarting || scopedUnready > 0

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
          {scopedUnready > 0 ? ` · ${scopedUnready} not ready` : ''}
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
                className={`block truncate ${pod.ready ? 'text-[var(--c9-muted)]' : 'text-red-300'}`}
                title={pod.name}
              >
                {compactPodName(pod.name) || pod.name}
              </span>
              <span className="block text-[var(--c9-text-disabled)]">{detail}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ReplicaFlatList({
  rows,
  selectedName,
  onSelectName,
}: {
  rows: Array<{
    name: string
    primaryText?: string
    rps?: number
    latencyMs: number
    latencyQuantile?: LatencyQuantile
    /** @deprecated use latencyMs */
    p99Ms?: number
    cpuPct?: number
    memPct?: number
    warn?: boolean
    hot?: boolean
  }>
  selectedName?: string | null
  onSelectName?: (name: string) => void
}) {
  if (rows.length === 0) return null
  return (
    <ul className="min-w-0 space-y-2 font-mono text-[10px] text-[var(--c9-text)]">
      {rows.map((row) => {
        const selected = selectedName === row.name
        const content = (
          <>
            <span className="block truncate text-[var(--c9-muted)]" title={row.name}>
              {compactPodName(row.name) || row.name}
            </span>
            <span className="block text-[var(--c9-text-disabled)]">
              {row.hot ? '🔥 ' : row.warn ? '⚠️ ' : ''}
              {row.primaryText ?? `${Math.round(row.rps ?? 0)} rps`}
              {' · '}
              {row.latencyQuantile ?? 'p99'} {Math.round(row.latencyMs ?? row.p99Ms ?? 0)}ms
              {row.cpuPct != null ? ` · CPU ${Math.round(row.cpuPct)}%` : ''}
              {row.memPct != null ? ` · Mem ${Math.round(row.memPct)}%` : ''}
            </span>
          </>
        )
        if (!onSelectName) {
          return (
            <li key={row.name} className="min-w-0 space-y-0.5">
              {content}
            </li>
          )
        }
        return (
          <li key={row.name} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelectName(row.name)}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)]/50 ${
                selected
                  ? 'border-[var(--c9-accent)]/60 bg-[var(--c9-accent-subtle)]'
                  : 'border-transparent hover:border-[var(--c9-border)] hover:bg-[var(--c9-bg-card)]/60'
              }`}
            >
              {content}
            </button>
          </li>
        )
      })}
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
  _warmingUp: boolean,
): boolean {
  if (m.cpuIsEstimated) return false
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
  _warmingUp: boolean,
): { cpu: string; mem: string } {
  return formatResourceLabels(m, cpuPercent, memPercent)
}

/** Overlay a db instance layer onto the cluster bucket for tooltip CPU/memory labels. */
export function tooltipResourceBucket(
  metrics: MetricsBucket,
  layer: ComponentLayerMetrics | undefined,
): MetricsBucket {
  if (!layer) return metrics
  return {
    ...metrics,
    cpuUsage: layer.cpuUsage,
    memoryBytes: layer.memoryBytes,
    cpuLimit: layer.cpuLimit,
    memoryLimit: layer.memoryLimit,
    cpuIsEstimated: layer.cpuIsEstimated,
    memIsEstimated: layer.memIsEstimated,
    cpuSource: layer.cpuSource,
    memSource: layer.memSource,
  }
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
): string {
  if (m.memIsEstimated) return memLabel
  return fmtPct(memPercent)
}
