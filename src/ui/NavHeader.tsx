import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function NavHeader() {
  const { pathname } = useLocation()
  const session = useAuthStore((s) => s.session)
  if (pathname === '/canvas') return null

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-gray-800/50 bg-gray-950/80 px-6 py-3 backdrop-blur-sm">
      <Link
        to="/"
        className="text-lg font-semibold tracking-tight text-white"
      >
        Cloud9
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/canvas"
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
        >
          Open Canvas
        </Link>
        {session ? (
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
