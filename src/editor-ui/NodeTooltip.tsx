import { useMemo } from 'react'
import { clampPercent, FMT_EMPTY, fmtMs, fmtRate } from '../lib/format'
import { compactPodName } from '../lib/replicaMetricsDisplay'
import { usesPodReplicaScope, findDbLayer } from '../lib/dbInstanceScope'
import { getTopologyFlags, resolveRole, withCacheEngineName } from '../lib/componentRole'
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
  cpuPct: number | null
  memPct: number | null
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
  const roleLabel = useMemo(() => {
    const text = resolveRole(node.type, snapshotTemplateId, topology, storytelling)
    if (node.type !== 'cache') return text
    return withCacheEngineName(
      text,
      String(node.config.cacheEngine ?? node.config.engine ?? 'redis'),
    )
  }, [node, snapshotTemplateId, topology, storytelling])

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

  const tooltipMetrics = cacheFocus && metrics
    ? tooltipResourceBucket(metrics, cacheFocus.layerMetrics)
    : metrics && node.type === 'database' && instanceScopeId && instanceScopeId !== 'cluster'
      ? tooltipResourceBucket(metrics, findDbLayer(metrics.layers, instanceScopeId))
      : metrics

  const cpuPct = cacheFocus
    ? cacheFocus.cpuPct ?? 0
    : grouped?.kind === 'single'
      ? grouped.cpuPct ?? 0
      : tooltipMetrics?.cpuIsEstimated
        ? 0
        : tooltipMetrics && tooltipMetrics.cpuLimit > 0
          ? clampPercent(tooltipMetrics.cpuPercent)
          : 0
  const memPct = cacheFocus
    ? cacheFocus.memPct ?? 0
    : grouped?.kind === 'single'
      ? grouped.memPct ?? 0
      : tooltipMetrics?.memIsEstimated
        ? 0
        : tooltipMetrics && tooltipMetrics.memoryLimit > 0
          ? clampPercent(tooltipMetrics.memPercent)
          : 0
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
    ? 'text-[var(--dt-color-text-muted)]'
    : health === 'warning'
      ? 'text-[var(--dt-color-amber)]'
      : health === 'error'
        ? 'text-[var(--dt-color-red)]'
        : 'text-[var(--dt-color-text)]'

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
      className={`pointer-events-none min-w-[150px] rounded-[7px] bg-[var(--dt-color-surface-raised)] px-[11px] pt-2 pb-[9px] text-[12px] text-[var(--dt-color-text)] shadow-[0_10px_26px_rgba(0,0,0,0.5)] ${
        align === 'right' ? 'origin-top-left' : 'origin-top-right -translate-x-full'
      }`}
    >
      <p className="mb-0.5 block truncate text-[13px] font-bold text-white">
        {node.label}
      </p>
      <p className="mb-[5px] flex items-center gap-1.5 text-[12px] text-[var(--dt-color-text-muted)]">
        <span
          className={`size-[7px] shrink-0 rounded-full ${
            health === 'error'
              ? 'bg-[var(--dt-color-red)]'
              : health === 'warning'
                ? 'bg-[var(--dt-color-amber)]'
                : 'bg-[#22c55e]'
          }`}
          aria-hidden
        />
        {subtitle ?? roleLabel}
      </p>
      <div className="grid grid-cols-[auto_auto] gap-x-3.5 gap-y-0.5">
        <span className="text-[var(--dt-color-text-subtle)]" title={resourceHelp}>
          CPU{clusterScope ? ' avg' : ''}
        </span>
        <span className="text-right font-bold tabular-nums">{labels.cpu}</span>
        <span className="text-[var(--dt-color-text-subtle)]" title={memTitle}>
          {clusterScope ? 'Mem avg' : 'Memory'}
        </span>
        <span className="text-right font-bold tabular-nums">{memDisplay}</span>
        <span className="text-[var(--dt-color-text-subtle)]">
          RPS{clusterScope ? ' sum' : ''}
        </span>
        <span className={`text-right font-bold tabular-nums ${rpsClass}`}>{fmtRate(rps)}</span>
        <span className="text-[var(--dt-color-text-subtle)]">
          P99{clusterScope ? ' max' : ''}
        </span>
        <span className="text-right font-bold tabular-nums">{p99Label}</span>
      </div>
    </div>
  )
}
