import { Html } from '@react-three/drei'
import { fmtCpuMilliCores, fmtMemMB, fmtPct, fmtRate } from '../lib/format'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'

interface StatusBadgeProps {
  nodeId: string
}

export function StatusBadge({ nodeId }: StatusBadgeProps) {
  const m = useMetricsStore((s) => s.metrics[nodeId])
  const isTrafficSource = useCanvasStore(
    (s) => s.nodes[nodeId]?.type === 'client'
  )
  if (!m) return null

  const allocTitle =
    'Kubernetes request/limit allocation (no live usage series for this metric)'

  return (
    <Html position={[0, 1.12, 0]} center zIndexRange={[20, 10]}>
      <div className="pointer-events-none flex gap-0.5 font-mono text-[8px] leading-tight">
        {!isTrafficSource ? (
          <>
            <span
              className={`rounded px-1 py-px text-white ${m.cpuIsEstimated ? 'bg-blue-500/70' : 'bg-blue-600/85'}`}
              title={m.cpuIsEstimated ? allocTitle : undefined}
            >
              CPU{' '}
              {m.cpuIsEstimated
                ? fmtCpuMilliCores(m.cpuUsage)
                : fmtPct(m.cpuPercent)}
            </span>
            <span
              className={`rounded px-1 py-px text-white ${m.memIsEstimated ? 'bg-green-500/70' : 'bg-green-600/85'}`}
              title={m.memIsEstimated ? allocTitle : undefined}
            >
              MEM{' '}
              {m.memIsEstimated
                ? fmtMemMB(m.memoryBytes)
                : fmtPct(m.memPercent)}
            </span>
          </>
        ) : null}
        {m.qps > 0 ? (
          <span className="rounded bg-orange-500/85 px-1 py-px text-white">
            {fmtRate(m.qps)} q/s
          </span>
        ) : null}
      </div>
    </Html>
  )
}
