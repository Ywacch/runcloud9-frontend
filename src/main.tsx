import './instrument'
import { createRoot } from 'react-dom/client'
import { reactErrorHandler } from '@sentry/react'
import { initAuth } from './lib/auth'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

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
