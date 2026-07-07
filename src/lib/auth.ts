import { supabase } from './supabase'
import { fetchUserRecord } from './userProfile'
import { useAuthStore } from '../product/stores/authStore'

/** Hydrate session from storage and subscribe to auth changes. */
export function initAuth(): void {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session)
    if (session?.user?.id) {
      void refreshUserRecord(session.user.id)
    }
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
    if (session?.user?.id) {
      void refreshUserRecord(session.user.id)
    } else {
      useAuthStore.getState().setUserRecord(null)
    }
  })
}

async function refreshUserRecord(userId: string): Promise<void> {
  const record = await fetchUserRecord(userId)
  useAuthStore.getState().setUserRecord(record)
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null
}
