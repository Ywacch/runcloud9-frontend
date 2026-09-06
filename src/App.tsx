import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomeRoute from './pages/HomeRoute'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import SetPasswordPage from './pages/SetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import CookiesPage from './pages/CookiesPage'
import { CookieConsentBanner } from './components/legal/CookieConsentBanner'
import { LOADTEST_ROUTE_ENABLED } from './lib/featureFlags'
import NavHeader from './editor-ui/NavHeader'
import { DocumentMeta } from './components/seo/DocumentMeta'
import { InternalOnlyRoute } from './product/InternalOnlyRoute'

const LoadtestPage = lazy(() => import('./pages/LoadtestPage'))

const CanvasPage = lazy(() => import('./pages/CanvasPage'))
const SvgCanvasPage = lazy(() => import('./pages/SvgCanvasPage'))

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
        <DocumentMeta />
        <NavHeader />
        <CookieConsentBanner />
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/pricing" element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/billing/success" element={<Navigate to="/profile" replace />} />
          <Route path="/billing/cancel" element={<Navigate to="/profile" replace />} />
          <Route
            path="/loadtest"
            element={
              LOADTEST_ROUTE_ENABLED ? (
                <Suspense fallback={<CanvasRouteFallback />}>
                  <LoadtestPage />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/canvas"
            element={
              <Suspense fallback={<CanvasRouteFallback />}>
                <SvgCanvasPage />
              </Suspense>
            }
          />
          <Route
            path="/canvas-pixi"
            element={
              <InternalOnlyRoute>
                <Suspense fallback={<CanvasRouteFallback />}>
                  <CanvasPage />
                </Suspense>
              </InternalOnlyRoute>
            }
          />
          <Route
            path="/canvas-svg"
            element={<Navigate to="/canvas" replace />}
          />
        </Routes>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}
