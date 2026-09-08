import { Link } from 'react-router-dom'
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function AboutPage() {
  return (
    <LegalPageLayout title="About RunCloud9">
      <p>
        RunCloud9 is a lab for software and system architecture. You run canonical designs
        on real Kubernetes and watch how they behave under load.
      </p>
      <p>
        Each session gets an isolated namespace, seeded data, load traffic, and live metrics.
        Start from URL shortener, e-commerce, or social feed presets, then change cache
        strategy, fan-out, and scale. Use simulation when a design is not ready to deploy.
      </p>
      <p>
        <Link to="/canvas" className="text-[var(--c9-accent)] hover:underline">
          Open the canvas
        </Link>{' '}
        or{' '}
        <Link to="/login" className="text-[var(--c9-accent)] hover:underline">
          sign in
        </Link>{' '}
        to start a session.
      </p>
    </LegalPageLayout>
  )
}
