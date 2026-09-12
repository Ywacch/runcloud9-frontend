import { getMe } from './api'
import { ApiError } from './apiError'
import {
  categorizeSafeError,
  identifyAnalyticsUser,
  resetAnalytics,
  trackEvent,
} from './analytics'
import {
  isNewOAuthUser,
  oauthAnalyticsProvider,
} from './authAnalytics'
import {
  applyDevAccountPreviewUser,
  DEV_ENGINEER_USER,
  isDevAccountPreviewEnabled,
} from './devAccountPreview'
import {
  clearCachedCurrentUser,
  readCachedCurrentUser,
} from './currentUserCache'
import { supabase } from './supabase'
import { useAuthStore } from '../product/stores/authStore'

function restoreCachedCurrentUser(userId: string): void {
  const current = useAuthStore.getState().currentUser
  if (current?.userId === userId) return
  const cached = readCachedCurrentUser(userId)
  if (cached) {
    useAuthStore.getState().setCurrentUser(cached)
    return
  }
  if (current && current.userId !== userId) {
    useAuthStore.getState().setCurrentUser(null)
  }
}

export function hydrateCachedCurrentUser(userId: string): void {
  restoreCachedCurrentUser(userId)
}

/** Avoid repeat auth_succeeded on every tab refresh for the same user. */
let identifiedUserId: string | null = null

/** Hydrate session from storage and subscribe to auth changes. */
export function initAuth(): void {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session)
    if (session?.user?.id) {
      restoreCachedCurrentUser(session.user.id)
      void refreshCurrentUser()
    } else {
      applyDevAccountPreviewUser(
        useAuthStore.getState().setCurrentUser,
        session,
      )
    }
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
    if (session?.user?.id) {
      restoreCachedCurrentUser(session.user.id)
      void refreshCurrentUser()
    } else {
      identifiedUserId = null
      resetAnalytics()
      clearCachedCurrentUser()
      applyDevAccountPreviewUser(
        useAuthStore.getState().setCurrentUser,
        session,
      )
    }
  })
}

export async function refreshCurrentUser(): Promise<void> {
  try {
    const me = await getMe()
    useAuthStore.getState().setCurrentUser(me)
    const supabaseUserId = useAuthStore.getState().session?.user?.id
    const sessionUser = useAuthStore.getState().session?.user
    if (supabaseUserId && supabaseUserId !== identifiedUserId) {
      const provider = sessionUser
        ? oauthAnalyticsProvider(sessionUser.app_metadata?.provider)
        : undefined
      const traits: Parameters<typeof identifyAnalyticsUser>[1] = {
        effectiveTier: me.effectiveTier,
        ...(provider ? { provider } : {}),
      }
      if (sessionUser?.email && typeof sessionUser.email === 'string') {
        const email = sessionUser.email.trim()
        if (email) {
          traits.email = email
          traits.$email = email
        }
      }
      const meta = sessionUser?.user_metadata as
        | Record<string, unknown>
        | undefined
      const nameRaw =
        typeof meta?.full_name === 'string'
          ? meta.full_name
          : typeof meta?.name === 'string'
            ? meta.name
            : ''
      const name = nameRaw.trim()
      if (name) traits.name = name
      if (
        sessionUser?.created_at &&
        typeof sessionUser.created_at === 'string'
      ) {
        traits.created_at = sessionUser.created_at
      }
      identifyAnalyticsUser(supabaseUserId, traits)
      trackEvent('auth_succeeded', {
        effectiveTier: me.effectiveTier,
        isNewUser: sessionUser ? isNewOAuthUser(sessionUser) : false,
        ...(provider ? { provider } : {}),
      })
      identifiedUserId = supabaseUserId
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().setSession(null)
      void supabase.auth.signOut()
      applyDevAccountPreviewUser(useAuthStore.getState().setCurrentUser, null)
      trackEvent('auth_failed', { errorCategory: 'unauthorized' })
      return
    }
    console.warn('refreshCurrentUser:', err)
    if (useAuthStore.getState().currentUser) {
      return
    }
    if (isDevAccountPreviewEnabled()) {
      useAuthStore.getState().setCurrentUser(DEV_ENGINEER_USER)
      return
    }
    useAuthStore.getState().setCurrentUser(null)
    trackEvent('auth_failed', { errorCategory: categorizeSafeError(err) })
  }
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null
}
