import { Link } from 'react-router-dom'
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function AboutPage() {
  return (
    <LegalPageLayout title="About RunCloud9">
      <p>
        RunCloud9 is an interactive architecture lab. You design distributed systems on a
        canvas — load balancers, app servers, databases, caches, queues — and deploy them to
        real Kubernetes for short, time-boxed sessions.
      </p>
      <p>
        Each session provisions an isolated namespace, seeds comparable data, runs load against
        your topology, and streams live metrics so you can see bottlenecks as they happen. It is
        built for learning and experimentation, not production hosting.
      </p>
      <p>
        We ship template-backed presets (URL shortener, e-commerce, social feed) so you start from
        a realistic baseline, then iterate on cache strategy, fan-out, and scaling choices. When
        a design is not ready for live deploy, simulation mode lets you explore behavior without
        cluster cost.
      </p>
      <p>
        RunCloud9 is in invite-only alpha. Access is limited while we tune capacity, admission,
        and the product surface. If you have an invite,{' '}
        <Link to="/login" className="text-[var(--c9-accent)] hover:underline">
          sign in
        </Link>{' '}
        to open the canvas or{' '}
        <Link to="/dashboard" className="text-[var(--c9-accent)] hover:underline">
          view your dashboard
        </Link>
        .
      </p>
    </LegalPageLayout>
  )
}
