/** After the client session clock hits zero, finish within this window. */
export const SESSION_END_FORCE_MS = 25_000

/** How often to poll deployment status while wrapping up. */
export const SESSION_END_STATUS_POLL_MS = 2_000

export const LIVE_SESSION_ENDED_MESSAGE =
  'This live session has ended. Data inspector is unavailable.'

export class IntrospectHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'IntrospectHttpError'
    this.status = status
  }
}

export function isLiveSessionPastEnd(endsAt: number | null, now = Date.now()): boolean {
  return endsAt != null && now >= endsAt
}

export function parseIntrospectErrorBody(text: string, status: number): string {
  const trimmed = text.trim()
  if (!trimmed) return `HTTP ${status}`
  try {
    const parsed = JSON.parse(trimmed) as { error?: string }
    if (typeof parsed.error === 'string') {
      if (parsed.error === 'deployment is not active') {
        return LIVE_SESSION_ENDED_MESSAGE
      }
      return parsed.error
    }
  } catch {
    /* not JSON */
  }
  return trimmed
}

export function introspectErrorMessage(err: unknown): string {
  if (err instanceof IntrospectHttpError) return err.message
  if (err instanceof Error) {
    const msg = err.message.trim()
    if (msg.startsWith('{')) {
      return parseIntrospectErrorBody(msg, 0)
    }
    return msg || 'Request failed'
  }
  return String(err)
}

export function isDeploymentInactiveError(err: unknown): boolean {
  if (err instanceof IntrospectHttpError) {
    return err.status === 410
  }
  if (err instanceof Error) {
    return (
      err.message.includes('deployment is not active') ||
      err.message.includes(LIVE_SESSION_ENDED_MESSAGE)
    )
  }
  return false
}
