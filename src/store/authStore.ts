import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'

interface AuthState {
  session: Session | null
  /** Derived from billing/profile later; stays false until wired to Supabase. */
  isPremium: boolean
  setSession: (s: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isPremium: false,
  setSession: (s) => set({ session: s, isPremium: false }),
}))
