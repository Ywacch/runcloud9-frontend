import { BrowserRouter, Route, Routes } from 'react-router-dom'
import CanvasPage from './pages/CanvasPage'
import LandingPage from './pages/LandingPage'
import NavHeader from './ui/NavHeader'

export default function App() {
  return (
    <BrowserRouter>
      <NavHeader />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/canvas" element={<CanvasPage />} />
      </Routes>
    </BrowserRouter>
  )
}
