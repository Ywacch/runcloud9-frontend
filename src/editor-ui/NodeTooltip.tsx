import { useMemo } from 'react'
import { clampPercent, fmtMs, fmtRate } from '../lib/format'
import { getTopologyFlags, resolveRole } from '../lib/componentRole'
import { syncDbTierCWarmup } from '../lib/tierCWarmupSession'
import type { HealthState } from '../editor-core/domain/healthThresholds'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import {
  formatDbClusterResourceLabels,
  formatResourceLabels,
} from './inspectorPanelUi'

interface NodeTooltipProps {
  node: CanvasNode
  metrics?: MetricsBucket
  health: HealthState
  align: 'left' | 'right'
}

export function NodeTooltip({
  node,
  metrics,
  health,
  align,
}: NodeTooltipProps) {
  const nodes = useCanvasStore((s) => s.nodes)
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
  const cpuPct = metrics?.cpuIsEstimated || dbWarmingUp ? 0 : clampPercent(metrics?.cpuPercent)
  const memPct = metrics?.memIsEstimated || dbWarmingUp ? 0 : clampPercent(metrics?.memPercent)
  const labels = metrics
    ? node.type === 'database'
      ? formatDbClusterResourceLabels(metrics, cpuPct, memPct, dbWarmingUp)
      : formatResourceLabels(metrics, cpuPct, memPct)
    : { cpu: '-', mem: '-' }
  const rpsClass =
    health === 'warning'
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
        {roleLabel}
      </p>
      <div className="mt-1 border-t border-white/10 pt-1.5">
        <div className="grid grid-cols-3 gap-2">
          <div>
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
          <div>
            <p className="font-mono text-[10px] lowercase text-zinc-400">memory</p>
            <p className="font-mono text-[12px] font-semibold leading-[1] text-zinc-100">
              {labels.mem}
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
              {fmtRate(metrics?.requestRate ?? 0)}
            </p>
            <div className="mt-1 h-[2px] rounded bg-zinc-700/70">
              <div className="h-full w-full rounded bg-cyan-400/85" />
            </div>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1">
          <span className="font-mono text-[10px] lowercase text-zinc-400">p99</span>
          <span className="font-mono text-[11px] text-zinc-200">
            {fmtMs(metrics?.p99Latency ?? 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
