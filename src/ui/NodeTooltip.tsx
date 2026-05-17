import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import {
  fmtCpuMilliCores,
  fmtMemMB,
  fmtMs,
  fmtPct,
  fmtRate,
} from '../lib/format'
import { getTopologyFlags, resolveRole } from '../lib/componentRole'
import type { HealthState } from '../lib/healthThresholds'
import type { CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'
import { useCanvasStore } from '../store/canvasStore'
import { useTemplateRegistryStore } from '../store/templateRegistryStore'

interface NodeTooltipProps {
  node: CanvasNode
  metrics?: MetricsBucket
  health: HealthState
  align: 'left' | 'right'
}

function pct(v: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round((v ?? 0) * 100)))
}

function cpuLabel(metrics: MetricsBucket | undefined): string {
  if (!metrics) return '-'
  if (metrics.cpuIsEstimated) {
    if (metrics.cpuLimit > 0) {
      return `${fmtCpuMilliCores(metrics.cpuLimit)} (allocated)`
    }
    return `${fmtCpuMilliCores(metrics.cpuUsage)} (est.)`
  }
  return fmtPct(metrics.cpuPercent)
}

function memLabel(metrics: MetricsBucket | undefined): string {
  if (!metrics) return '-'
  if (metrics.memIsEstimated) {
    if (metrics.memoryLimit > 0) {
      return `${fmtMemMB(metrics.memoryLimit)} (allocated)`
    }
    return `${fmtMemMB(metrics.memoryBytes)} (est.)`
  }
  return fmtPct(metrics.memPercent)
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

  const cpuPct = metrics?.cpuIsEstimated ? 0 : pct(metrics?.cpuPercent)
  const memPct = metrics?.memIsEstimated ? 0 : pct(metrics?.memPercent)
  const cpuValue = cpuLabel(metrics)
  const memValue = memLabel(metrics)
  const rpsClass =
    health === 'warning'
      ? 'text-amber-300'
      : health === 'error'
        ? 'text-red-300'
        : 'text-cyan-300'
  const x = align === 'right' ? 0.92 : -0.92

  const cpuHint = metrics?.cpuIsEstimated
    ? 'Allocated to this pod. Real utilization appears once metrics collection starts, or if the pod restarted.'
    : 'CPU utilization vs pod limit. Sustained high values mean pressure.'
  const memHint = metrics?.memIsEstimated
    ? 'Allocated to this pod. Real utilization appears once metrics collection starts, or if the pod restarted.'
    : 'Memory utilization vs pod limit. Watch for pressure before OOM risk.'
  const rpsHint =
    'Request throughput through this component (rolling view from the stream).'

  return (
    <Html
      position={[x, 1.35, 0]}
      center={false}
      zIndexRange={[25, 12]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className={`pointer-events-none w-[178px] rounded-xl border border-indigo-300/18 bg-[#11152a]/95 px-2.5 py-2 text-[10px] text-zinc-200 shadow-xl backdrop-blur ${
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
                {cpuValue}
              </p>
              <p className="mt-0.5 text-[8px] leading-snug text-zinc-500">{cpuHint}</p>
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
                {memValue}
              </p>
              <p className="mt-0.5 text-[8px] leading-snug text-zinc-500">{memHint}</p>
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
              <p className="mt-0.5 text-[8px] leading-snug text-zinc-500">{rpsHint}</p>
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
          <p className="mt-0.5 text-[8px] leading-snug text-zinc-500">
            End-to-end tail latency for this hop (from metrics stream).
          </p>
        </div>
      </div>
    </Html>
  )
}
