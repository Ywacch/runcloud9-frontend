import type { AIPostmortem } from './aiPostmortem'

export const POSTMORTEM_POLL_INTERVAL_MS = 5_000
export const POSTMORTEM_POLL_MAX_MS = 4 * 60_000

export type PostmortemSlideState = 'hidden' | 'pending' | 'error' | 'ready'

function postmortemHasContent(pm: AIPostmortem): boolean {
  return (
    pm.summary.trim().length > 0 ||
    pm.claims.length > 0 ||
    pm.insufficientEvidence.length > 0
  )
}

export function isSettledPostmortem(
  postmortem: AIPostmortem | null | undefined,
): boolean {
  if (!postmortem) return false
  return postmortem.status !== 'pending'
}

export function shouldPollPostmortem(input: {
  postmortem: AIPostmortem | null | undefined
  isInternal: boolean
  hasDeploymentId: boolean
  elapsedMs: number
}): boolean {
  if (!input.isInternal || !input.hasDeploymentId) return false
  if (input.elapsedMs >= POSTMORTEM_POLL_MAX_MS) return false
  if (!input.postmortem) return true
  return input.postmortem.status === 'pending'
}

export function postmortemSlideState(input: {
  postmortem: AIPostmortem | null | undefined
  isInternal: boolean
  polling: boolean
  pollTimedOut: boolean
}): PostmortemSlideState {
  const { postmortem, isInternal, polling, pollTimedOut } = input
  if (!isInternal) {
    if (postmortem?.status === 'ok' && postmortemHasContent(postmortem)) {
      return 'ready'
    }
    return 'hidden'
  }
  if (postmortem?.status === 'error') return 'error'
  if (postmortem?.status === 'ok' && postmortemHasContent(postmortem)) {
    return 'ready'
  }
  if (postmortem?.status === 'skipped') return 'hidden'
  if (polling) return 'pending'
  if (pollTimedOut && !isSettledPostmortem(postmortem)) return 'error'
  return 'hidden'
}
