import { supabase } from './supabase'
import type { UserRecord } from './userTier'

type UsersRow = {
  is_internal: boolean
  is_premium: boolean
  premium_expires_at: string | null
}

/** Load billing/admin fields from public.users for the signed-in auth user. */
export async function fetchUserRecord(userId: string): Promise<UserRecord | null> {
  const { data, error } = await supabase
    .from('users')
    .select('is_internal,is_premium,premium_expires_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('fetchUserRecord:', error.message)
    return null
  }
  if (!data) return null

  const row = data as UsersRow
  return {
    isInternal: Boolean(row.is_internal),
    isPremium: Boolean(row.is_premium),
    premiumExpiresAt: row.premium_expires_at,
  }
}
