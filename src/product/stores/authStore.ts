import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { UserRecord } from '../../lib/userTier'
import { hasPaidTier } from '../../lib/userTier'

interface AuthState {
  session: Session | null
  userRecord: UserRecord | null
  /** Derived from userRecord — engineer/internal with valid premium or internal flag. */
  isPremium: boolean
  /** Set when user hits Deploy while signed out; cleared after resume or dismiss. */
  pendingDeployAfterAuth: boolean
  setSession: (s: Session | null) => void
  setUserRecord: (record: UserRecord | null) => void
  setPendingDeployAfterAuth: (pending: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  userRecord: null,
  isPremium: false,
  pendingDeployAfterAuth: false,
  setSession: (s) =>
    set({
      session: s,
      ...(s == null ? { userRecord: null, isPremium: false, pendingDeployAfterAuth: false } : {}),
    }),
  setUserRecord: (userRecord) =>
    set({
      userRecord,
      isPremium: hasPaidTier(userRecord),
    }),
  setPendingDeployAfterAuth: (pendingDeployAfterAuth) => set({ pendingDeployAfterAuth }),
}))
