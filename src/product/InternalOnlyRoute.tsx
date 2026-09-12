import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hydrateCachedCurrentUser, refreshCurrentUser } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './stores/authStore'

type Props = {
  children: ReactNode
}

/**
 * Route gate for internal-tier accounts (`GET /me` → isInternal / effectiveTier).
 * Skipped in local Vite DEV so `/canvas-pixi` stays open while iterating.
 * Production builds (`import.meta.env.PROD`) always enforce the gate.
 */
export function InternalOnlyRoute({ children }: Props) {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      const next = data.session
      useAuthStore.getState().setSession(next)
      if (next?.user?.id) {
        hydrateCachedCurrentUser(next.user.id)
        await refreshCurrentUser()
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (import.meta.env.DEV) {
    return children
  }

  if (!ready) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-white text-zinc-600">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm font-medium">Checking access…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const allowed =
    currentUser?.isInternal === true ||
    currentUser?.effectiveTier === 'internal'

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return children
}
