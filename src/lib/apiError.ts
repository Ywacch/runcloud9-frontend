export class ApiError extends Error {
  status: number
  rawMessage: string
  /** Machine reason from API JSON when present (e.g. design_exceeds_cluster_capacity). */
  reason?: string

  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.rawMessage = message
    this.reason = reason
  }
}

export function isMissingUserRecordError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  const raw = (error.rawMessage || error.message || '').toLowerCase()
  return error.status === 500 && raw.includes('failed to load user')
}
