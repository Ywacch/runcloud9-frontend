import { useCallback, useEffect, useMemo, useState } from 'react'
import { startLoadGen, stopLoadGen } from '../lib/api'
import { fmtInt } from '../lib/format'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function LiveOverlay() {
  const mode = useCanvasStore((s) => s.mode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const liveSessionEndsAt = useCanvasStore((s) => s.liveSessionEndsAt)
  const loadgen = useMetricsStore((s) => s.loadgen)

  const [remaining, setRemaining] = useState(0)
  const [rps, setRps] = useState(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!liveSessionEndsAt || mode !== 'live') {
      setRemaining(0)
      return
    }
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((liveSessionEndsAt - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [liveSessionEndsAt, mode])

  const deployStatus = useMemo(() => {
    const list = Object.values(nodes)
    if (list.some((n) => n.status === 'degraded')) return 'Degraded'
    if (list.some((n) => n.status === 'provisioning')) return 'Provisioning'
    return 'Running'
  }, [nodes])

  const badgeClass =
    deployStatus === 'Degraded'
      ? 'bg-red-600'
      : deployStatus === 'Provisioning'
        ? 'bg-amber-600'
        : 'bg-emerald-600'

  const onStartLoad = useCallback(async () => {
    if (!deploymentId) return
    setBusy(true)
    setError(null)
    try {
      await startLoadGen(deploymentId, {
        rps,
        durationSeconds: 0,
        template: snapshotTemplateId ?? '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load start failed')
    } finally {
      setBusy(false)
    }
  }, [deploymentId, rps, snapshotTemplateId])

  const onStopLoad = useCallback(async () => {
    if (!deploymentId) return
    setBusy(true)
    setError(null)
    try {
      await stopLoadGen(deploymentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stop load failed')
    } finally {
      setBusy(false)
    }
  }, [deploymentId])

  if (mode !== 'live' || !deploymentId) return null

  return (
    <div className="pointer-events-auto absolute top-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-gray-700/80 bg-gray-900/90 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur-sm">
        <span className="max-w-[220px] truncate font-mono text-xs text-gray-300" title={deploymentId}>
          {deploymentId}
        </span>
        <span className="text-gray-500">|</span>
        <span className="text-xs text-gray-300">
          Session{' '}
          <span className="font-mono text-white">{formatMmSs(remaining)}</span>
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium text-white ${badgeClass}`}
        >
          {deployStatus}
        </span>
        <span className="text-gray-500">|</span>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          RPS
          <input
            type="number"
            min={1}
            max={500}
            value={rps}
            onChange={(e) => setRps(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-white"
          />
        </label>
        {loadgen?.totalRequests != null ? (
          <span className="text-xs text-gray-400">
            Total:{' '}
            <span className="font-mono text-white">
              {fmtInt(loadgen.totalRequests)}
            </span>
          </span>
        ) : null}
        {loadgen?.active ? (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-mono ${
              (loadgen.successRate ?? 0) >= 99
                ? 'bg-emerald-900/50 text-emerald-300'
                : (loadgen.successRate ?? 0) >= 95
                  ? 'bg-amber-900/50 text-amber-300'
                  : 'bg-red-900/50 text-red-300'
            }`}
          >
            {(loadgen.successRate ?? 0).toFixed(1)}%
          </span>
        ) : null}
        {loadgen?.active ? (
          <button
            type="button"
            disabled={busy}
            onClick={onStopLoad}
            className="rounded bg-orange-700 px-3 py-1 text-xs font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            Stop load
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onStartLoad}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            Start load
          </button>
        )}
      </div>
      {error ? (
        <p className="max-w-md rounded bg-red-950/90 px-3 py-1 text-center text-xs text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  )
}
