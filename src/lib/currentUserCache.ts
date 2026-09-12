import type { CurrentUserResponse } from './api'

const STORAGE_KEY = 'c9.currentUser.v1'
const DEV_PREVIEW_USER_ID = 'dev-preview-user'

function isEffectiveTier(
  value: unknown,
): value is CurrentUserResponse['effectiveTier'] {
  return value === 'free' || value === 'engineer' || value === 'internal'
}

function parseCachedCurrentUser(raw: unknown): CurrentUserResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.userId !== 'string' || !row.userId.trim()) return null
  if (row.userId === DEV_PREVIEW_USER_ID) return null
  if (typeof row.isInternal !== 'boolean') return null
  if (typeof row.isPremium !== 'boolean') return null
  if (row.premiumExpiresAt != null && typeof row.premiumExpiresAt !== 'string') {
    return null
  }
  if (!isEffectiveTier(row.effectiveTier)) return null
  if (typeof row.quotaTier !== 'string' || !row.quotaTier.trim()) return null
  if (!row.limits || typeof row.limits !== 'object') return null
  const limits = row.limits as CurrentUserResponse['limits']
  if (typeof limits.maxLoadgenRps !== 'number') return null
  return row as unknown as CurrentUserResponse
}

/** Last GET /me for this tab — avoids treating signed-in internals as Free before /me returns. */
export function readCachedCurrentUser(userId: string): CurrentUserResponse | null {
  const id = userId.trim()
  if (!id) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: string; me?: unknown }
    if (parsed.userId !== id) return null
    return parseCachedCurrentUser(parsed.me)
  } catch {
    return null
  }
}

export function writeCachedCurrentUser(
  userId: string,
  me: CurrentUserResponse,
): void {
  const id = userId.trim()
  if (!id || id === DEV_PREVIEW_USER_ID || me.userId === DEV_PREVIEW_USER_ID) {
    return
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: id, me }))
  } catch {
    /* private mode / quota */
  }
}

export function clearCachedCurrentUser(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode */
  }
}
