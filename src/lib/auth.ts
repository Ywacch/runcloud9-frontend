import { getMe } from './api'
import { ApiError } from './apiError'
import { supabase } from './supabase'
import { useAuthStore } from '../product/stores/authStore'

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
    }
  })
}

export async function refreshCurrentUser(): Promise<void> {
  try {
    const me = await getMe()
    useAuthStore.getState().setCurrentUser(me)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().setSession(null)
      void supabase.auth.signOut()
      return
    }
    console.warn('refreshCurrentUser:', err)
    useAuthStore.getState().setCurrentUser(null)
  }
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null
}
