import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { applyDevAccountPreviewUser } from '../lib/devAccountPreview'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../product/stores/authStore'
import Landing from './Landing'

export default function HomeRoute() {
  const session = useAuthStore((s) => s.session)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      useAuthStore.getState().setSession(data.session)
      applyDevAccountPreviewUser(
        useAuthStore.getState().setCurrentUser,
        data.session,
      )
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--c9-bg)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--c9-accent)] border-t-transparent"
          aria-hidden
        />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return <Landing />
}
