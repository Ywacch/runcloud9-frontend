import { useMemo } from 'react'
import { clampPercent, FMT_EMPTY, fmtMs, fmtRate } from '../lib/format'
import { compactPodName } from '../lib/replicaMetricsDisplay'
import { usesPodReplicaScope, findDbLayer } from '../lib/dbInstanceScope'
import { getTopologyFlags, resolveRole } from '../lib/componentRole'
import {
  dbTooltipLatencyMs,
  rollup,
  samplesFromCompute,
  samplesFromLayers,
} from '../lib/instanceRollup'
import { syncDbTierCWarmup } from '../lib/tierCWarmupSession'
import type { HealthState } from '../editor-core/domain/healthThresholds'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { resolveCacheCanvasFocus } from '../lib/cacheCanvasFocus'
import {
  dbClusterResourceHelp,
  formatDbClusterResourceLabels,
  formatResourceLabels,
  resourceUsageHelp,
  tooltipMemoryDisplay,
  tooltipResourceBucket,
} from './inspectorPanelUi'

interface NodeTooltipProps {
  node: CanvasNode
  metrics?: MetricsBucket
  health: HealthState
  align: 'left' | 'right'
}

const DB_IDLE_RPS_FLOOR = 8

type SingleRollupDisplay = {
  kind: 'single'
  cpuPct: number
  memPct: number
  rps: number
  p99Ms: number | null
  idle: boolean
  instanceLabel?: string
  clusterScope?: boolean
}

function compactInstanceLabel(id: string): string {
  return compactPodName(id) || id
}

export function resolveGroupedDisplay(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  instanceScopeId: string | null,
): SingleRollupDisplay | null {
  if (!metrics) return null

  if (instanceScopeId && instanceScopeId !== 'cluster') {
    const sample =
      usesPodReplicaScope(node)
        ? samplesFromCompute(metrics).find((s) => s.id === instanceScopeId)
        : node.type === 'database'
          ? samplesFromLayers(metrics).find((s) => s.id === instanceScopeId)
          : undefined
    if (sample) {
      const rolled = rollup([sample], {
        idleFloor: node.type === 'database' ? DB_IDLE_RPS_FLOOR : undefined,
      })
      return {
        kind: 'single',
        cpuPct: rolled.cpuPct,
        memPct: rolled.memPct,
        rps: rolled.rps,
        p99Ms: rolled.p99 != null && rolled.p99 > 0 ? rolled.p99 * 1000 : null,
        idle: rolled.idle,
        instanceLabel:
          usesPodReplicaScope(node)
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
      const rolled = rollup(samples, { idleFloor: DB_IDLE_RPS_FLOOR })
      const rps =
        rolled.rps > 0
          ? rolled.rps
          : metrics.dbQueryRate > 0
            ? metrics.dbQueryRate
            : metrics.requestRate
      return {
        kind: 'single',
        cpuPct: metrics.cpuIsEstimated ? 0 : clampPercent(metrics.cpuPercent),
        memPct: metrics.memIsEstimated ? 0 : clampPercent(metrics.memPercent),
        rps,
        p99Ms: rolled.p99 != null && rolled.p99 > 0 ? rolled.p99 * 1000 : null,
        idle: rps < DB_IDLE_RPS_FLOOR,
        clusterScope: true,
      }
    }
  }

  if (usesPodReplicaScope(node) && metrics.podReplicas.length > 1) {
    const rolled = rollup(samplesFromCompute(metrics))
    return {
      kind: 'single',
      cpuPct: metrics.cpuIsEstimated ? 0 : rolled.cpuPct,
      memPct: metrics.memIsEstimated ? 0 : rolled.memPct,
      rps: rolled.rps,
      p99Ms: rolled.p99 != null && rolled.p99 > 0 ? rolled.p99 * 1000 : null,
      idle: false,
      clusterScope: true,
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

  const instanceScopeId = hoveredInstanceId

  const grouped = useMemo(
    () => resolveGroupedDisplay(node, metrics, instanceScopeId),
    [node, metrics, instanceScopeId],
  )

  const cacheFocus =
    node.type === 'cache' && metrics ? resolveCacheCanvasFocus(metrics) : null

  const tooltipMetrics = cacheFocus
    ? tooltipResourceBucket(metrics, cacheFocus.layerMetrics)
    : metrics && node.type === 'database' && instanceScopeId && instanceScopeId !== 'cluster'
      ? tooltipResourceBucket(metrics, findDbLayer(metrics.layers, instanceScopeId))
      : metrics

  const cpuPct = cacheFocus
    ? cacheFocus.cpuPct
    : grouped?.kind === 'single'
      ? grouped.cpuPct
      : tooltipMetrics?.cpuIsEstimated
        ? 0
        : clampPercent(tooltipMetrics?.cpuPercent)
  const memPct = cacheFocus
    ? cacheFocus.memPct
    : grouped?.kind === 'single'
      ? grouped.memPct
      : tooltipMetrics?.memIsEstimated
        ? 0
        : clampPercent(tooltipMetrics?.memPercent)
  const labels = tooltipMetrics
    ? node.type === 'database'
      ? formatDbClusterResourceLabels(tooltipMetrics, cpuPct, memPct, dbWarmingUp)
      : formatResourceLabels(tooltipMetrics, cpuPct, memPct)
    : { cpu: '-', mem: '-' }
  const resourceHelp = tooltipMetrics
    ? node.type === 'database'
      ? dbClusterResourceHelp(tooltipMetrics, dbWarmingUp)
      : resourceUsageHelp(tooltipMetrics)
    : undefined
  const memDisplay = tooltipMetrics
    ? tooltipMemoryDisplay(tooltipMetrics, memPct, labels.mem)
    : labels.mem
  const memTitle =
    tooltipMetrics && !tooltipMetrics.memIsEstimated && labels.mem !== '-'
      ? labels.mem
      : undefined

  const rps =
    grouped?.kind === 'single'
      ? grouped.rps
      : metrics?.requestRate ?? 0
  const idleRps = grouped?.kind === 'single' ? grouped.idle : false
  const dbLayerForScope =
    metrics && node.type === 'database' && instanceScopeId && instanceScopeId !== 'cluster'
      ? findDbLayer(metrics.layers, instanceScopeId)
      : undefined
  const tooltipP99Ms =
    grouped?.p99Ms != null && grouped.p99Ms > 0
      ? grouped.p99Ms
      : node.type === 'database' && metrics
        ? dbTooltipLatencyMs(metrics, dbLayerForScope)
        : metrics?.p99Latency != null && metrics.p99Latency > 0
          ? metrics.p99Latency
          : null
  const p99Label = tooltipP99Ms != null ? fmtMs(tooltipP99Ms) : FMT_EMPTY

  const rpsClass = idleRps
    ? 'text-zinc-400'
    : health === 'warning'
      ? 'text-amber-300'
      : health === 'error'
        ? 'text-red-300'
        : 'text-cyan-300'

  const clusterScope = grouped?.clusterScope === true && !cacheFocus
  const subtitle = cacheFocus
    ? `${roleLabel} · ${cacheFocus.layer}`
    : grouped?.instanceLabel != null
      ? `${roleLabel} · ${grouped.instanceLabel}`
      : clusterScope
        ? 'Cluster'
        : roleLabel !== node.label
          ? roleLabel
          : null

  return (
    <div
      className={`pointer-events-none w-[178px] rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg-surface)] px-2.5 py-2 text-[10px] text-[var(--c9-text)] shadow-xl backdrop-blur ${
        align === 'right' ? 'origin-top-left' : 'origin-top-right -translate-x-full'
      }`}
    >
      <p className="truncate text-center text-[13px] font-semibold text-violet-300">
        {node.label}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-center text-[9px] leading-tight text-zinc-400">
          {subtitle}
        </p>
      ) : null}
      <div className="mt-1 border-t border-white/10 pt-1.5">
        <div className="grid grid-cols-3 gap-2">
          <div title={resourceHelp}>
            <p className="whitespace-nowrap font-mono text-[10px] lowercase text-zinc-400">
              cpu
              {clusterScope ? <span className="text-zinc-600"> avg</span> : null}
            </p>
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
            <p className="whitespace-nowrap font-mono text-[10px] lowercase text-zinc-400">
              {clusterScope ? 'mem' : 'memory'}
              {clusterScope ? <span className="text-zinc-600"> avg</span> : null}
            </p>
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
            <p className="whitespace-nowrap font-mono text-[10px] lowercase text-zinc-400">
              rps
              {clusterScope ? <span className="text-zinc-600"> sum</span> : null}
            </p>
            <p className={`font-mono text-[16px] font-semibold leading-[1] ${rpsClass}`}>
              {fmtRate(rps)}
            </p>
            <div className="mt-1 h-[2px] rounded bg-zinc-700/70">
              <div className="h-full w-full rounded bg-cyan-400/85" />
            </div>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1">
          <span className="whitespace-nowrap font-mono text-[10px] lowercase text-zinc-400">
            p99
            {clusterScope ? <span className="text-zinc-600"> max</span> : null}
          </span>
          <span className="font-mono text-[11px] text-zinc-200">{p99Label}</span>
        </div>
      </div>
    </div>
  )
}
