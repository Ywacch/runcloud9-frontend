import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { CurrentUserResponse } from '../../lib/api'
import {
  canAccessPremiumTemplates,
  type UserRecord,
} from '../../lib/userTier'

function userRecordFromMe(me: CurrentUserResponse): UserRecord {
  return {
    isInternal: me.isInternal,
    isPremium: me.isPremium,
    premiumExpiresAt: me.premiumExpiresAt,
  }
}

interface AuthState {
  session: Session | null
  currentUser: CurrentUserResponse | null
  /** Thin projection for template preset / display copy call sites. */
  userRecord: UserRecord | null
  /** Derived from currentUser — engineer/internal with valid premium or internal flag. */
  isPremium: boolean
  /** Set when user hits Deploy while signed out; cleared after resume or dismiss. */
  pendingDeployAfterAuth: boolean
  setSession: (s: Session | null) => void
  setCurrentUser: (me: CurrentUserResponse | null) => void
  setPendingDeployAfterAuth: (pending: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  currentUser: null,
  userRecord: null,
  isPremium: false,
  pendingDeployAfterAuth: false,
  setSession: (s) =>
    set({
      session: s,
      ...(s == null
        ? {
            currentUser: null,
            userRecord: null,
            isPremium: false,
            pendingDeployAfterAuth: false,
          }
        : {}),
    }),
  setCurrentUser: (currentUser) => {
    const userRecord = currentUser ? userRecordFromMe(currentUser) : null
    set({
      currentUser,
      userRecord,
      isPremium: currentUser
        ? canAccessPremiumTemplates(
            userRecord,
            currentUser.limits.allTemplates,
          )
        : false,
    })
  },
  setPendingDeployAfterAuth: (pendingDeployAfterAuth) => set({ pendingDeployAfterAuth }),
}))
