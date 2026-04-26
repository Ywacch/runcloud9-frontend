import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function readTypeFromHash(): string | null {
  const raw = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(raw)
  return params.get('type')
}

function readTypeFromSearch(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('type')
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const run = async () => {
      const search = new URLSearchParams(window.location.search)
      const code = search.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          navigate('/login', { replace: true })
          return
        }
      }

      const authType = readTypeFromHash() ?? readTypeFromSearch()
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        navigate('/login', { replace: true })
        return
      }

      if (authType === 'recovery' || authType === 'invite') {
        navigate('/set-password', { replace: true })
        return
      }

      navigate('/canvas', { replace: true })
    }
    void run()
  }, [navigate])

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
      <div className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-3 text-sm text-[var(--c9-muted)]">
        Completing sign-in…
      </div>
    </main>
  )
}
