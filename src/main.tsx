import './instrument'
import { createRoot } from 'react-dom/client'
import { reactErrorHandler } from '@sentry/react'
import { initAnalytics } from './lib/analytics'
import { initAuth } from './lib/auth'
import './index.css'
import './editor-ui/stacklabChrome.css'
import './editor-ui/stacklabInspector.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

void initAnalytics()
initAuth()

createRoot(document.getElementById('root')!, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
)
