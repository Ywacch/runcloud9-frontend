import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import NavHeader from './ui/NavHeader'

const CanvasPage = lazy(() => import('./pages/CanvasPage'))

function CanvasRouteFallback() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"
        aria-hidden
      />
      <p className="text-sm font-medium">Loading canvas…</p>
    </div>
  )
}

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null }

  static getDerivedStateFromError(e: Error) {
    return { error: e.message || String(e) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Root error boundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-950 p-8 text-center text-white">
          <p className="text-lg font-semibold">Something went wrong</p>
          <pre className="max-h-40 max-w-xl overflow-auto rounded bg-gray-800 px-4 py-3 text-left text-xs text-red-300">
            {this.state.error}
          </pre>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <NavHeader />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/canvas"
            element={
              <Suspense fallback={<CanvasRouteFallback />}>
                <CanvasPage />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}
