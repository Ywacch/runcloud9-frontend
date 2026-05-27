import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'

interface AuthState {
  session: Session | null
  /** Derived from billing/profile later; stays false until wired to Supabase. */
  isPremium: boolean
  /** Set when user hits Deploy while signed out; cleared after resume or dismiss. */
  pendingDeployAfterAuth: boolean
  setSession: (s: Session | null) => void
  setPendingDeployAfterAuth: (pending: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isPremium: false,
  pendingDeployAfterAuth: false,
  setSession: (s) =>
    set({
      session: s,
      isPremium: false,
      ...(s == null ? { pendingDeployAfterAuth: false } : {}),
    }),
  setPendingDeployAfterAuth: (pendingDeployAfterAuth) => set({ pendingDeployAfterAuth }),
}))
