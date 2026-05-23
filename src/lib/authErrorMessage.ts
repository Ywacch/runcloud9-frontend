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

export function mapSupabaseSignInError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return 'Email or password is incorrect.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirm your email before signing in.'
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return raw || 'Could not sign in. Try again.'
}

export function debugAuthError(error: unknown, context: string): void {
  if (error instanceof ApiError) {
    console.debug(`[auth:${context}] ${error.status} ${error.rawMessage}`)
    return
  }
  console.debug(`[auth:${context}]`, error)
}
