import { Html } from '@react-three/drei'
import { fmtMs, fmtPct, fmtRate } from '../lib/format'
import type { HealthState } from '../lib/healthThresholds'
import type { CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'

interface NodeTooltipProps {
  node: CanvasNode
  metrics?: MetricsBucket
  health: HealthState
  align: 'left' | 'right'
}

function pct(v: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round((v ?? 0) * 100)))
}

export function NodeTooltip({
  node,
  metrics,
  health,
  align,
}: NodeTooltipProps) {
  const cpuPct = pct(metrics?.cpuPercent)
  const memPct = pct(metrics?.memPercent)
  const rpsClass = health === 'high-load' ? 'text-amber-300' : 'text-cyan-300'
  const x = align === 'right' ? 0.92 : -0.92

  return (
    <Html
      position={[x, 1.35, 0]}
      center={false}
      zIndexRange={[25, 12]}
      /* drei ignores pointerEvents prop unless transform={true}; without this the portal div steals the
         cursor, the mesh fires pointerleave, tooltip unmounts, then pointerenter again → flicker. */
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
        <div className="mt-1 border-t border-white/10 pt-1.5">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="font-mono text-[10px] lowercase text-zinc-400">cpu</p>
              <p className="font-mono text-[16px] font-semibold leading-[1] text-zinc-100">
                {fmtPct(cpuPct)}
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
              <p className="font-mono text-[16px] font-semibold leading-[1] text-zinc-100">
                {fmtPct(memPct)}
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
            <span className="font-mono text-[11px] text-zinc-200">{fmtMs(metrics?.p99Latency ?? 0)}</span>
          </div>
        </div>
      </div>
    </Html>
  )
}
