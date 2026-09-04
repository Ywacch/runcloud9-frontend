import { ApiError } from './apiError'

const SESSION_EXPIRED_COPY = 'Session expired or missing. Please sign in again.'

export const RESET_PASSWORD_SUCCESS_COPY =
  'If an account exists for that email and it uses a password, we sent a reset link. If you signed in with Google or GitHub, use that button instead.'

const OAUTH_SIGN_IN_HINT = ' If you signed in with Google or GitHub, use that button.'

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

const GITHUB_EMAIL_HELP_COPY =
  'We could not get a verified email from GitHub. In GitHub Settings → Emails, set a primary email and allow applications to see it, then try again.'

function oauthErrorMessage(raw: string): string | null {
  const msg = raw.toLowerCase()
  if (
    msg.includes('provider is not enabled') ||
    msg.includes('provider_disabled') ||
    msg.includes('unsupported provider')
  ) {
    return 'This sign-in method is not available yet. Try another sign-in option.'
  }
  if (
    msg.includes('error getting user email') ||
    msg.includes('email_address_not_provided') ||
    msg.includes('provider_email_needs_verification') ||
    msg.includes('unverified email with github') ||
    (msg.includes('github') && msg.includes('email') && msg.includes('verif'))
  ) {
    return GITHUB_EMAIL_HELP_COPY
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return null
}

export function mapSupabaseOAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  return oauthErrorMessage(raw) ?? raw ?? 'Could not start sign-in. Try again.'
}

export function mapAuthCallbackError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const oauth = oauthErrorMessage(raw)
  if (oauth) return oauth
  return mapSupabaseOtpError(error)
}

export function mapSupabaseSignInError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return `Email or password is incorrect.${OAUTH_SIGN_IN_HINT}`
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirm your email before signing in.'
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return raw || 'Could not sign in. Try again.'
}

export function mapSupabaseOtpError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const msg = raw.toLowerCase()
  if (msg.includes('expired') || msg.includes('otp_expired')) {
    return 'This sign-in or reset link has expired. Request a new one.'
  }
  if (msg.includes('invalid') || msg.includes('otp_disabled') || msg.includes('not found')) {
    return 'This link is invalid or has already been used.'
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return raw || 'Could not verify this link. Request a new sign-in or reset link.'
}

export function debugAuthError(error: unknown, context: string): void {
  if (error instanceof ApiError) {
    console.debug(`[auth:${context}] ${error.status} ${error.rawMessage}`)
    return
  }
  console.debug(`[auth:${context}]`, error)
}
