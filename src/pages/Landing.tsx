import { Features } from '../components/landing/Features'
import { Hero } from '../components/landing/Hero'
import { Navbar } from '../components/landing/Navbar'

export default function Landing() {
  return (
    <div className="bg-[var(--c9-bg)] text-[var(--c9-text)]">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>
    </div>
  )
}
