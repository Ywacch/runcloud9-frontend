import { useEffect } from 'react'
import { Features } from '../components/landing/Features'
import { Footer } from '../components/landing/Footer'
import { Hero } from '../components/landing/Hero'
import { Navbar } from '../components/landing/Navbar'
import { referrerCategory, trackEvent, utmFieldsFromSearch } from '../lib/analytics'

export default function Landing() {
  useEffect(() => {
    trackEvent('landing_viewed', {
      referrerCategory: referrerCategory(),
      ...utmFieldsFromSearch(),
    })
  }, [])

  return (
    <div className="bg-c9-bg text-c9-text">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>
      <Footer />
    </div>
  )
}
