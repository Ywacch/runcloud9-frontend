import { ApiError } from './api'

const SESSION_EXPIRED_COPY = 'Session expired or missing. Please sign in again.'

export function mapAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const raw = (error.rawMessage || error.message || '').toLowerCase()
    if (
      error.status === 401 ||
      raw.includes('missing or invalid authorization header') ||
      raw.includes('invalid token')
    ) {
      return SESSION_EXPIRED_COPY
    }
    return error.rawMessage || fallback
  }
  if (error instanceof Error) return error.message || fallback
  return fallback
}

export function debugAuthError(error: unknown, context: string): void {
  if (error instanceof ApiError) {
    console.debug(`[auth:${context}] ${error.status} ${error.rawMessage}`)
    return
  }
  console.debug(`[auth:${context}]`, error)
}
