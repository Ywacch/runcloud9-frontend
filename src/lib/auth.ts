import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'

/** Hydrate session from storage and subscribe to auth changes. */
export function initAuth(): void {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
  })
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null
}
