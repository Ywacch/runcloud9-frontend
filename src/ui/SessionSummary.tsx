import {
  fmtErrorRate,
  fmtInt,
  fmtMs,
  fmtPct,
} from '../lib/format'
import { useCanvasStore } from '../store/canvasStore'

export function SessionSummary() {
  const summary = useCanvasStore((s) => s.sessionSummary)
  const dismiss = () => useCanvasStore.getState().setSessionSummary(null)

  if (!summary) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Session Complete</h2>
            <p className="text-xs text-gray-400">
              {summary.template} · {summary.duration}
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
            Finished
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="Peak RPS" value={fmtInt(summary.peakRps)} />
          <SummaryCard label="Peak p99" value={fmtMs(summary.peakP99)} />
          <SummaryCard
            label="Total Requests"
            value={fmtInt(summary.totalRequests)}
          />
          <SummaryCard
            label="Cache Hit Rate"
            value={fmtPct(summary.cacheHitRate)}
          />
          <SummaryCard
            label="Avg Latency"
            value={fmtMs(summary.avgLatency)}
          />
          <SummaryCard
            label="Error Rate"
            value={fmtErrorRate(summary.errorRate)}
          />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Components
          </h3>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {Object.entries(summary.componentSummaries).map(([nodeId, c]) => (
              <div
                key={nodeId}
                className="flex items-center justify-between rounded bg-gray-800/50 px-3 py-1.5 text-xs"
              >
                <span className="text-gray-300">{c.label}</span>
                <span className="font-mono text-gray-400">
                  CPU {c.cpuSummary} · Mem {c.memSummary}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          Back to Design
        </button>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-white">{value}</div>
    </div>
  )
}
