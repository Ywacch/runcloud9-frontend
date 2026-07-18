import { getMe } from './api'
import { ApiError } from './apiError'
import {
  categorizeSafeError,
  identifyAnalyticsUser,
  resetAnalytics,
  trackEvent,
} from './analytics'
import { supabase } from './supabase'
import { useAuthStore } from '../product/stores/authStore'

/** Avoid repeat auth_succeeded on every tab refresh for the same user. */
let identifiedUserId: string | null = null

/** Hydrate session from storage and subscribe to auth changes. */
export function initAuth(): void {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session)
    if (session?.user?.id) {
      void refreshCurrentUser()
    }
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
    if (session?.user?.id) {
      void refreshCurrentUser()
    } else {
      useAuthStore.getState().setCurrentUser(null)
      identifiedUserId = null
      resetAnalytics()
    }
  })
}

export async function refreshCurrentUser(): Promise<void> {
  try {
    const me = await getMe()
    useAuthStore.getState().setCurrentUser(me)
    const supabaseUserId = useAuthStore.getState().session?.user?.id
    if (supabaseUserId && supabaseUserId !== identifiedUserId) {
      identifyAnalyticsUser(supabaseUserId, {
        effectiveTier: me.effectiveTier,
      })
      trackEvent('auth_succeeded', { effectiveTier: me.effectiveTier })
      identifiedUserId = supabaseUserId
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().setSession(null)
      void supabase.auth.signOut()
      trackEvent('auth_failed', { errorCategory: 'unauthorized' })
      return
    }
    console.warn('refreshCurrentUser:', err)
    useAuthStore.getState().setCurrentUser(null)
    trackEvent('auth_failed', { errorCategory: categorizeSafeError(err) })
  }
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null
}
