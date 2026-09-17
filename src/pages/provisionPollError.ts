export const PROVISION_POLL_UNREACHABLE_MESSAGE =
  "Can't reach the API. Still waiting, retrying automatically."

export const PROVISION_FAILED_MESSAGE =
  'Deployment failed during provisioning.'

export function nextProvisionPollError(
  consecutiveFailures: number,
  previousError: string | null,
): string | null {
  if (consecutiveFailures < 3) return previousError
  return PROVISION_POLL_UNREACHABLE_MESSAGE
}

export function clearProvisionPollErrorOnSuccess(
  previousError: string | null,
): string | null {
  if (previousError === PROVISION_POLL_UNREACHABLE_MESSAGE) return null
  return previousError
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return (err as { name?: string }).name === 'AbortError'
  }
  return false
}
