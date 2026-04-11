import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950 pt-14 text-white">
      <section className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <h1 className="text-5xl font-bold leading-tight tracking-tight">
          Design distributed systems.
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Deploy them. Watch them break.
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-gray-400">
          Real Kubernetes infrastructure. Real bottlenecks. Build your
          architecture on an interactive 3D canvas, deploy to live clusters, and
          observe how it handles production-scale traffic — all in 10 minutes.
        </p>
        <Link
          to="/canvas"
          className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:brightness-110"
        >
          Launch the Canvas →
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 md:grid-cols-3">
        {[
          {
            title: 'Design',
            desc: 'Drag components onto a 3D isometric canvas. Connect them. Configure cache strategies, LB algorithms, replicas.',
            icon: '🧱',
          },
          {
            title: 'Deploy',
            desc: 'One click deploys real Kubernetes pods — PostgreSQL, Redis, Nginx, RabbitMQ — in an ephemeral sandbox.',
            icon: '🚀',
          },
          {
            title: 'Observe',
            desc: 'Watch live metrics stream: RPS, latency percentiles, cache hit rates. See what breaks under load.',
            icon: '📊',
          },
        ].map(({ title, desc, icon }) => (
          <div
            key={title}
            className="rounded-xl border border-gray-800 bg-gray-900/70 p-6"
          >
            <div className="mb-3 text-3xl">{icon}</div>
            <h3 className="mb-2 text-lg font-semibold">{title}</h3>
            <p className="text-sm text-gray-400">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
