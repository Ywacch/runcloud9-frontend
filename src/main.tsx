import { createRoot } from 'react-dom/client'
import { initAuth } from './lib/auth'
import './index.css'
import App from './App.tsx'

initAuth()

createRoot(document.getElementById('root')!).render(<App />)
