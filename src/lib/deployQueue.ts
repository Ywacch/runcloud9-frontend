/** Rough ETA formatting for deploy-queue overlay copy. */
export function formatQueueWaitEstimate(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return '~4m'
  }
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m <= 0) return `~${Math.max(1, rem)}s`
  if (rem === 0) return `~${m}m`
  return `~${m}m ${rem}s`
}

export function formatQueueWaitingDetail(opts: {
  queuePosition?: number | null
  estimatedWaitSeconds?: number | null
}): string {
  const pos =
    typeof opts.queuePosition === 'number' &&
    Number.isFinite(opts.queuePosition) &&
    opts.queuePosition > 0
      ? Math.floor(opts.queuePosition)
      : null
  const eta = formatQueueWaitEstimate(opts.estimatedWaitSeconds ?? 240)
  if (pos != null) {
    return `You're #${pos} in line. Estimated wait ${eta}.`
  }
  return `Waiting for capacity. Estimated wait ${eta}.`
}

export function isQueueFullErrorMessage(raw: string): boolean {
  const n = raw.toLowerCase()
  return n.includes('queue_full') || n.includes('deploy queue is full')
}

export function isUserConcurrentDeployErrorMessage(raw: string): boolean {
  const n = raw.toLowerCase()
  return (
    n.includes('already have an active deployment') ||
    n.includes('concurrent deployment')
  )
}
