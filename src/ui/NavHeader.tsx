import { Link, useLocation } from 'react-router-dom'

export default function NavHeader() {
  const { pathname } = useLocation()
  if (pathname === '/canvas') return null

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-gray-800/50 bg-gray-950/80 px-6 py-3 backdrop-blur-sm">
      <Link
        to="/"
        className="text-lg font-semibold tracking-tight text-white"
      >
        Cloud9
      </Link>
      <Link
        to="/canvas"
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        Open Canvas
      </Link>
    </header>
  )
}
