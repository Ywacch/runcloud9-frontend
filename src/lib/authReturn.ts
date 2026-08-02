const AUTH_RETURN_STORAGE_KEY = 'runcloud9.authReturnTo'

/** In-app paths safe to return to after sign-in. */
const ALLOWED_RETURN_PATHS = new Set([
  '/dashboard',
  '/profile',
  '/canvas',
  '/about',
  '/privacy',
  '/terms',
  '/pricing',
  '/billing/success',
  '/billing/cancel',
])

const BLOCKED_RETURN_PATHS = new Set([
  '/',
  '/login',
  '/auth/callback',
  '/reset-password',
  '/set-password',
])

function pathnameOnly(path: string): string {
  const noHash = path.split('#')[0] ?? path
  return (noHash.split('?')[0] ?? noHash).trim()
}

/** Reject off-origin, protocol-relative, and auth/login bounce targets. */
export function sanitizeAuthReturnPath(
  path: string | null | undefined,
): string | null {
  if (path == null) return null
  const trimmed = path.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//') || trimmed.includes('://')) return null

  const pathname = pathnameOnly(trimmed)
  if (!pathname || pathname.length > 200) return null
  if (BLOCKED_RETURN_PATHS.has(pathname)) return null
  if (pathname.startsWith('/auth/') || pathname.startsWith('/login')) return null
  if (!ALLOWED_RETURN_PATHS.has(pathname)) return null
  return pathname
}

export function setAuthReturnTo(path: string): void {
  const safe = sanitizeAuthReturnPath(path)
  if (!safe) return
  try {
    sessionStorage.setItem(AUTH_RETURN_STORAGE_KEY, safe)
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekAuthReturnTo(): string | null {
  try {
    return sanitizeAuthReturnPath(sessionStorage.getItem(AUTH_RETURN_STORAGE_KEY))
  } catch {
    return null
  }
}

export function consumeAuthReturnTo(fallback = '/dashboard'): string {
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(AUTH_RETURN_STORAGE_KEY)
    if (stored) sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return (
    sanitizeAuthReturnPath(stored) ??
    sanitizeAuthReturnPath(fallback) ??
    '/dashboard'
  )
}

export function loginPathWithReturnTo(returnPath: string): string {
  const safe = sanitizeAuthReturnPath(returnPath)
  if (!safe) return '/login'
  return `/login?returnTo=${encodeURIComponent(safe)}`
}
