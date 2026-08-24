import { useMemo } from 'react'
import { clampPercent, fmtMs, fmtPct, fmtRate } from '../lib/format'
import { compactPodName } from '../lib/replicaMetricsDisplay'
import { getTopologyFlags, resolveRole } from '../lib/componentRole'
import {
  rollup,
  samplesFromCompute,
  samplesFromLayers,
  splitByRole,
} from '../lib/instanceRollup'
import { syncDbTierCWarmup } from '../lib/tierCWarmupSession'
import type { HealthState } from '../editor-core/domain/healthThresholds'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import {
  formatDbClusterResourceLabels,
  formatResourceLabels,
  resourceUsageHelp,
  tooltipMemoryDisplay,
} from './inspectorPanelUi'

interface NodeTooltipProps {
  node: CanvasNode
  metrics?: MetricsBucket
  health: HealthState
  align: 'left' | 'right'
}

const DB_IDLE_RPS_FLOOR = 8

type DbSplitDisplay = {
  kind: 'db-split'
  primary: ReturnType<typeof rollup>
  replica: ReturnType<typeof rollup>
  rps: number
  idle: boolean
}

type SingleRollupDisplay = {
  kind: 'single'
  cpuPct: number
  memPct: number
  rps: number
  p99Ms: number | null
  idle: boolean
  instanceLabel?: string
}

function compactInstanceLabel(id: string): string {
  return compactPodName(id) || id
}

function resolveGroupedDisplay(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  dbWarmingUp: boolean,
  instanceScopeId: string | null,
): DbSplitDisplay | SingleRollupDisplay | null {
  if (!metrics) return null

  if (instanceScopeId) {
    const sample =
      node.type === 'compute'
        ? samplesFromCompute(metrics).find((s) => s.id === instanceScopeId)
        : node.type === 'database'
          ? samplesFromLayers(metrics).find((s) => s.id === instanceScopeId)
          : undefined
    if (sample) {
      const rolled = rollup([sample], {
        idleFloor: node.type === 'database' ? DB_IDLE_RPS_FLOOR : undefined,
      })
      const warmed =
        node.type === 'database' && dbWarmingUp
          ? { ...rolled, cpuPct: 0, memPct: 0 }
          : rolled
      return {
        kind: 'single',
        cpuPct: warmed.cpuPct,
        memPct: warmed.memPct,
        rps: warmed.rps,
        p99Ms: warmed.p99 != null && warmed.p99 > 0 ? warmed.p99 * 1000 : null,
        idle: warmed.idle,
        instanceLabel:
          node.type === 'compute'
            ? compactInstanceLabel(sample.id)
            : sample.role === 'primary'
              ? 'primary'
              : compactInstanceLabel(sample.id),
      }
    }
  }

  if (node.type === 'database') {
    const samples = samplesFromLayers(metrics)
    const hasReplicas = samples.some((sample) => sample.role === 'replica')
    if (hasReplicas && samples.length > 0) {
      const byRole = splitByRole(samples)
      const primaryRollup = rollup(byRole.get('primary') ?? [])
      const replicaRollup = rollup(byRole.get('replica') ?? [])
      const layerRps = primaryRollup.rps + replicaRollup.rps
      const rps =
        layerRps > 0
          ? layerRps
          : metrics.dbQueryRate > 0
            ? metrics.dbQueryRate
            : metrics.requestRate
      return {
        kind: 'db-split',
        primary: dbWarmingUp
          ? { ...primaryRollup, cpuPct: 0, memPct: 0 }
          : primaryRollup,
        replica: dbWarmingUp
          ? { ...replicaRollup, cpuPct: 0, memPct: 0 }
          : replicaRollup,
        rps,
        idle: rps < DB_IDLE_RPS_FLOOR,
      }
    }
  }

  if (node.type === 'compute' && metrics.podReplicas.length > 1) {
    const rolled = rollup(samplesFromCompute(metrics))
    return {
      kind: 'single',
      cpuPct: rolled.cpuPct,
      memPct: rolled.memPct,
      rps: rolled.rps,
      p99Ms: rolled.p99 != null && rolled.p99 > 0 ? rolled.p99 * 1000 : null,
      idle: false,
    }
  }

  return null
}

export function NodeTooltip({
  node,
  metrics,
  health,
  align,
}: NodeTooltipProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedInstanceId = useCanvasStore((s) => s.selectedInstanceId)
  const hoveredInstanceId = useCanvasStore((s) => s.hoveredInstanceId)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const storytelling = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.storytelling : undefined,
  )
  const topology = useMemo(() => getTopologyFlags(nodes), [nodes])
  const roleLabel = useMemo(
    () => resolveRole(node.type, snapshotTemplateId, topology, storytelling),
    [node.type, snapshotTemplateId, topology, storytelling],
  )

  const dbWarmingUp =
    node.type === 'database' && metrics
      ? syncDbTierCWarmup(node.id, metrics, Date.now())
      : false

  const instanceScopeId = useMemo(() => {
    if (
      selectedId === node.id &&
      selectedInstanceId &&
      selectedInstanceId !== 'cluster'
    ) {
      return selectedInstanceId
    }
    return hoveredInstanceId
  }, [selectedId, node.id, selectedInstanceId, hoveredInstanceId])

  const grouped = useMemo(
    () => resolveGroupedDisplay(node, metrics, dbWarmingUp, instanceScopeId),
    [node, metrics, dbWarmingUp, instanceScopeId],
  )

  const cpuPct =
    grouped?.kind === 'single'
      ? grouped.cpuPct
      : metrics?.cpuIsEstimated || dbWarmingUp
        ? 0
        : clampPercent(metrics?.cpuPercent)
  const memPct =
    grouped?.kind === 'single'
      ? grouped.memPct
      : metrics?.memIsEstimated || dbWarmingUp
        ? 0
        : clampPercent(metrics?.memPercent)
  const labels = metrics
    ? node.type === 'database'
      ? formatDbClusterResourceLabels(metrics, cpuPct, memPct, dbWarmingUp)
      : formatResourceLabels(metrics, cpuPct, memPct)
    : { cpu: '-', mem: '-' }
  const resourceHelp = metrics ? resourceUsageHelp(metrics) : undefined
  const memDisplay = metrics
    ? tooltipMemoryDisplay(metrics, memPct, labels.mem, dbWarmingUp)
    : labels.mem
  const memTitle =
    memDisplay !== labels.mem && labels.mem !== '-' ? labels.mem : undefined

  const rps =
    grouped?.kind === 'db-split'
      ? grouped.rps
      : grouped?.kind === 'single'
        ? grouped.rps
        : metrics?.requestRate ?? 0
  const idleRps = grouped?.kind === 'db-split' ? grouped.idle : false
  const p99Label =
    grouped?.kind === 'single'
      ? grouped.p99Ms != null
        ? fmtMs(grouped.p99Ms)
        : '—'
      : grouped?.kind === 'db-split'
        ? '—'
        : metrics?.p99Latency != null && metrics.p99Latency > 0
          ? fmtMs(metrics.p99Latency)
          : '—'

  const rpsClass = idleRps
    ? 'text-zinc-400'
    : health === 'warning'
      ? 'text-amber-300'
      : health === 'error'
        ? 'text-red-300'
        : 'text-cyan-300'

  return (
    <div
      className={`pointer-events-none w-[178px] rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-surface)] px-2.5 py-2 text-[10px] text-[var(--c9-text)] shadow-xl backdrop-blur ${
        align === 'right' ? 'origin-top-left' : 'origin-top-right -translate-x-full'
      }`}
    >
      <p className="truncate text-center text-[13px] font-semibold text-violet-300">
        {node.label}
      </p>
      <p className="mt-0.5 text-center text-[9px] leading-tight text-zinc-400">
        {grouped?.kind === 'single' && grouped.instanceLabel
          ? `${roleLabel} · ${grouped.instanceLabel}`
          : roleLabel}
      </p>
      <div className="mt-1 border-t border-white/10 pt-1.5">
        {grouped?.kind === 'db-split' ? (
          <>
            <div className="space-y-1">
              {(
                [
                  { label: 'primary', roll: grouped.primary },
                  { label: 'replicas', roll: grouped.replica },
                ] as const
              ).map(({ label, roll }) => (
                <div key={label} className="flex items-baseline justify-between gap-1">
                  <span className="font-mono text-[9px] lowercase text-zinc-500">{label}</span>
                  <span className="font-mono text-[10px] text-zinc-200">
                    cpu {fmtPct(roll.cpuPct)} · mem {fmtPct(roll.memPct)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1">
              <span className="font-mono text-[10px] lowercase text-zinc-400">rps</span>
              <span className={`font-mono text-[14px] font-semibold leading-[1] ${rpsClass}`}>
                {fmtRate(rps)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1">
              <span className="font-mono text-[10px] lowercase text-zinc-400">p99</span>
              <span className="font-mono text-[11px] text-zinc-200">{p99Label}</span>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div title={resourceHelp}>
                <p className="font-mono text-[10px] lowercase text-zinc-400">cpu</p>
                <p className="font-mono text-[12px] font-semibold leading-[1] text-zinc-100">
                  {labels.cpu}
                </p>
                <div className="mt-1 h-[2px] rounded bg-zinc-700/70">
                  <div
                    className="h-full rounded bg-violet-400 transition-[width] duration-150"
                    style={{ width: `${cpuPct}%` }}
                  />
                </div>
              </div>
              <div title={memTitle}>
                <p className="font-mono text-[10px] lowercase text-zinc-400">memory</p>
                <p className="font-mono text-[12px] font-semibold leading-[1] text-zinc-100">
                  {memDisplay}
                </p>
                <div className="mt-1 h-[2px] rounded bg-zinc-700/70">
                  <div
                    className="h-full rounded bg-sky-400 transition-[width] duration-150"
                    style={{ width: `${memPct}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] lowercase text-zinc-400">rps</p>
                <p className={`font-mono text-[16px] font-semibold leading-[1] ${rpsClass}`}>
                  {fmtRate(rps)}
                </p>
                <div className="mt-1 h-[2px] rounded bg-zinc-700/70">
                  <div className="h-full w-full rounded bg-cyan-400/85" />
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1">
              <span className="font-mono text-[10px] lowercase text-zinc-400">p99</span>
              <span className="font-mono text-[11px] text-zinc-200">{p99Label}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
