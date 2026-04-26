import { useCallback, useEffect, useMemo, useState } from 'react'
import { startLoadGen, stopLoadGen } from '../lib/api'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import { fmtInt } from '../lib/format'
import { useCanvasStore } from '../store/canvasStore'
import { useAuthStore } from '../store/authStore'
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
  const session = useAuthStore((s) => s.session)
  const loadgen = useMetricsStore((s) => s.loadgen)
  const streamWarning = useMetricsStore((s) => s.streamWarning)

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
    if (!session?.access_token) {
      setError('Please sign in again to run load testing.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await startLoadGen(deploymentId, {
        rps,
        durationSeconds: 0,
        template: snapshotTemplateId ?? '',
      })
    } catch (e) {
      debugAuthError(e, 'loadgen-start')
      setError(
        mapAuthErrorMessage(e, 'Could not start load testing. Please try again.'),
      )
    } finally {
      setBusy(false)
    }
  }, [deploymentId, rps, session?.access_token, snapshotTemplateId])

  const onStopLoad = useCallback(async () => {
    if (!deploymentId) return
    if (!session?.access_token) {
      setError('Please sign in again to run load testing.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await stopLoadGen(deploymentId)
    } catch (e) {
      debugAuthError(e, 'loadgen-stop')
      setError(
        mapAuthErrorMessage(e, 'Could not stop load testing. Please try again.'),
      )
    } finally {
      setBusy(false)
    }
  }, [deploymentId, session?.access_token])

  if (mode !== 'live' || !deploymentId) return null

  return (
    <div className="pointer-events-auto flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-start gap-x-2 gap-y-1 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/80 px-2 py-1.5 text-sm shadow-md backdrop-blur-md">
        <span className="max-w-[220px] truncate font-mono text-xs font-medium text-[var(--c9-text)]" title={deploymentId}>
          {deploymentId}
        </span>
        <span className="text-[var(--c9-muted)]">|</span>
        <span className="text-xs">
          <span className="font-semibold text-[var(--c9-muted)]">Session</span>{' '}
          <span className="font-mono font-semibold text-[var(--c9-text)]">
            {formatMmSs(remaining)}
          </span>
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold text-white shadow-sm ${badgeClass}`}
        >
          {deployStatus}
        </span>
        <span className="text-[var(--c9-muted)]">|</span>
        <label className="flex items-center gap-1 text-xs">
          <span className="font-semibold text-[var(--c9-muted)]">RPS</span>
          <input
            type="number"
            min={1}
            max={500}
            value={rps}
            onChange={(e) => setRps(Math.max(1, Number(e.target.value) || 1))}
            className="w-14 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-1.5 py-0.5 text-sm font-mono font-semibold text-[var(--c9-text)] backdrop-blur-sm"
          />
        </label>
        {loadgen?.totalRequests != null ? (
          <span className="text-xs">
            <span className="font-semibold text-[var(--c9-muted)]">Total</span>{' '}
            <span className="font-mono font-semibold text-[var(--c9-text)]">
              {fmtInt(loadgen.totalRequests)}
            </span>
          </span>
        ) : null}
        {loadgen?.active ? (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${
              (loadgen.successRate ?? 0) >= 99
                ? 'bg-emerald-900/60 text-emerald-100'
                : (loadgen.successRate ?? 0) >= 95
                  ? 'bg-amber-900/60 text-amber-100'
                  : 'bg-red-900/60 text-red-100'
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
            className="rounded bg-orange-600 px-2 py-0.5 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-orange-500 disabled:opacity-50"
          >
            Stop load
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onStartLoad}
            className="rounded bg-[var(--c9-accent)] px-2 py-0.5 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] disabled:opacity-50"
          >
            Start load
          </button>
        )}
      </div>
      {error ? (
        <p className="max-w-full rounded border border-red-700/50 bg-red-950/65 px-2 py-1 text-left text-xs font-medium text-red-100 backdrop-blur-sm">
          {error}
        </p>
      ) : null}
      {streamWarning ? (
        <p className="max-w-full rounded border border-amber-700/50 bg-amber-950/65 px-2 py-1 text-left text-xs font-medium text-amber-100 backdrop-blur-sm">
          {streamWarning}
        </p>
      ) : null}
    </div>
  )
}
