import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function readTypeFromHash(): string | null {
  const raw = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(raw)
  return params.get('type')
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const authType = readTypeFromHash()
    if (authType === 'recovery') {
      navigate(`/reset-password${window.location.hash}`, { replace: true })
      return
    }
    navigate('/canvas', { replace: true })
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6 pt-20 text-white">
      <p className="text-sm text-gray-300">Completing sign-in…</p>
    </main>
  )
}
