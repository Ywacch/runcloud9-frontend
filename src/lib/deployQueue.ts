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

export const ROOM_QUEUE_TITLE = 'Waiting for room'
export const DOOR_WAIT_TITLE = 'Almost ready'

/** Room queue: wait-list index is not “next to deploy,” so no leading #N. */
export function formatRoomWaitingDetail(opts: {
  estimatedWaitSeconds?: number | null
}): string {
  const eta = formatQueueWaitEstimate(opts.estimatedWaitSeconds ?? 240)
  return `Needs more free capacity than is available. Smaller deploys may start first. About ${eta}.`
}

/** Doorway wait: FIFO position is truthful. */
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
    return `#${pos}. About ${eta}.`
  }
  return `About ${eta}.`
}

/** True when GET/poll returned usable queue position or wait ETA. */
export function hasQueueWaitFields(opts: {
  queuePosition?: number | null
  estimatedWaitSeconds?: number | null
}): boolean {
  const pos =
    typeof opts.queuePosition === 'number' &&
    Number.isFinite(opts.queuePosition) &&
    opts.queuePosition > 0
  const eta =
    typeof opts.estimatedWaitSeconds === 'number' &&
    Number.isFinite(opts.estimatedWaitSeconds) &&
    opts.estimatedWaitSeconds >= 0
  return pos || eta
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

export const MONTHLY_SESSION_LIMIT = 'monthly_session_limit'

export function isMonthlySessionLimitError(opts: {
  reason?: string | null
  message?: string | null
}): boolean {
  if (opts.reason === MONTHLY_SESSION_LIMIT) return true
  const n = (opts.message ?? '').toLowerCase()
  return (
    n.includes(MONTHLY_SESSION_LIMIT) ||
    n.includes('monthly session limit')
  )
}

/** True when /me reports a monthly cap and remaining successful sessions is 0. */
export function isAtMonthlySessionCap(me: {
  sessionsRemainingThisMonth?: number | null
  limits?: { maxSessionsPerMonth?: number | null }
} | null | undefined): boolean {
  if (!me) return false
  if (me.limits?.maxSessionsPerMonth == null) return false
  return (
    typeof me.sessionsRemainingThisMonth === 'number' &&
    me.sessionsRemainingThisMonth <= 0
  )
}

export const DESIGN_EXCEEDS_CLUSTER_CAPACITY = 'design_exceeds_cluster_capacity'

export function isDesignExceedsClusterCapacity(opts: {
  reason?: string | null
  message?: string | null
}): boolean {
  if (opts.reason === DESIGN_EXCEEDS_CLUSTER_CAPACITY) return true
  const n = (opts.message ?? '').toLowerCase()
  return (
    n.includes(DESIGN_EXCEEDS_CLUSTER_CAPACITY) ||
    n.includes('more cpu or memory than the cluster provides')
  )
}
