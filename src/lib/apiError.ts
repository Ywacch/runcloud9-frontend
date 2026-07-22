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
