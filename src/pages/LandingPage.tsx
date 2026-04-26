import { useState } from 'react'
import { Link } from 'react-router-dom'

const SHOW_DEMO_VIDEO = false

type HeroCardProps = {
  title: string
  subtitle: string
  variant?: 'blue' | 'amber' | 'red'
  className?: string
}

function HeroCanvasCard({ title, subtitle, variant = 'blue', className }: HeroCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const accents =
    variant === 'amber'
      ? {
          glow: 'from-amber-400/40 via-orange-400/10 to-transparent',
          card: 'border-amber-500/40',
          text: 'text-amber-300',
          nodeA: 'bg-amber-500 shadow-[0_8px_0_0_rgba(146,64,14,0.85)]',
          nodeB: 'bg-zinc-300 shadow-[0_8px_0_0_rgba(113,113,122,0.85)]',
          nodeC: 'bg-amber-700 shadow-[0_8px_0_0_rgba(120,53,15,0.85)]',
        }
      : variant === 'red'
        ? {
            glow: 'from-rose-400/35 via-red-400/10 to-transparent',
            card: 'border-rose-500/40',
            text: 'text-rose-300',
            nodeA: 'bg-blue-500 shadow-[0_8px_0_0_rgba(30,64,175,0.85)]',
            nodeB: 'bg-zinc-300 shadow-[0_8px_0_0_rgba(113,113,122,0.85)]',
            nodeC: 'bg-red-700 shadow-[0_8px_0_0_rgba(127,29,29,0.85)]',
          }
        : {
            glow: 'from-cyan-400/40 via-blue-400/10 to-transparent',
            card: 'border-cyan-500/40',
            text: 'text-cyan-300',
            nodeA: 'bg-sky-500 shadow-[0_8px_0_0_rgba(30,64,175,0.85)]',
            nodeB: 'bg-zinc-300 shadow-[0_8px_0_0_rgba(113,113,122,0.85)]',
            nodeC: 'bg-orange-700 shadow-[0_8px_0_0_rgba(120,53,15,0.85)]',
          }

  return (
    <div
      className={`group absolute h-56 w-80 rounded-2xl border bg-zinc-900/85 shadow-[0_22px_50px_-20px_rgba(0,0,0,0.75)] transition-transform duration-200 will-change-transform ${accents.card} ${className ?? ''}`}
      style={{
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const px = (e.clientX - rect.left) / rect.width
        const py = (e.clientY - rect.top) / rect.height
        const nextX = (0.5 - py) * 8
        const nextY = (px - 0.5) * 10
        setTilt({ x: nextX, y: nextY })
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${accents.glow}`} />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-800/85 via-zinc-900/95 to-zinc-950/95" />
      <div className="relative flex h-full flex-col p-3">
        <div className={`mb-2 inline-flex w-fit rounded-full border border-zinc-600 bg-zinc-950/90 px-2 py-0.5 text-[10px] font-semibold ${accents.text}`}>
          {title}
        </div>
        <p className="mb-2 text-[10px] text-zinc-500">{subtitle}</p>
        <div className="relative flex-1 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/90">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:22px_22px]" />
          <div className={`absolute left-4 top-4 h-7 w-14 rounded ${accents.nodeA}`} />
          <div className={`absolute left-24 top-9 h-8 w-20 rounded ${accents.nodeB}`} />
          <div className={`absolute left-48 top-14 h-10 w-24 rounded ${accents.nodeB}`} />
          <div className={`absolute left-56 top-28 h-10 w-20 rounded ${accents.nodeC}`} />
          <div className={`absolute left-40 top-34 h-10 w-20 rounded ${accents.nodeB}`} />
          <div className="absolute left-16 top-14 h-0.5 w-16 bg-cyan-200/70" />
          <div className="absolute left-43 top-20 h-0.5 w-20 bg-cyan-200/70" />
          <div className="absolute left-53 top-31 h-0.5 w-18 rotate-[25deg] bg-cyan-200/70" />
          <div className="absolute left-50 top-28 h-0.5 w-14 -rotate-[40deg] bg-cyan-200/70" />
          <div className="absolute right-2 top-2 rounded bg-zinc-900/90 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
            live
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 pt-14 text-white selection:bg-cyan-500/30">
      <section className="relative overflow-hidden border-b border-zinc-800/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(244,63,94,0.1),transparent_35%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-18 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-700/60 bg-cyan-950/40 px-3 py-1 text-xs font-medium tracking-[0.12em] text-cyan-300">
              Invite-only alpha
            </p>
            <h1 className="max-w-xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-100 md:text-6xl">
              Don&apos;t just design your architecture. Deploy it.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg">
              RunCloud9 spins up real distributed systems on live infrastructure.
              Drop load balancers, databases, caches, and message queues onto the
              canvas, then watch what happens when traffic hits them. All in 9
              minutes.
            </p>
            <Link
              to="/canvas"
              className="mt-8 inline-flex rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_14px_28px_-10px_rgba(34,211,238,0.5)] transition hover:-translate-y-0.5 hover:bg-cyan-400"
            >
              Deploy your first architecture →
            </Link>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-500">
              <span className="rounded border border-zinc-700 px-2 py-1">Real K8s deploys</span>
              <span className="rounded border border-zinc-700 px-2 py-1">9-minute sessions</span>
              <span className="rounded border border-zinc-700 px-2 py-1">Live metrics + logs</span>
            </div>
          </div>

          <div className="relative h-[20.5rem] [perspective:1100px] sm:h-[23rem] lg:h-[26rem]">
            <HeroCanvasCard
              title="Read-heavy URL shortener"
              subtitle="LB → app → cache + postgres"
              variant="blue"
              className="left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 md:w-[22rem]"
            />
            <HeroCanvasCard
              title="Queue-backed ingestion"
              subtitle="events fanout + worker saturation"
              variant="amber"
              className="left-2 top-9 z-10 hidden rotate-[-6deg] opacity-90 md:block"
            />
            <HeroCanvasCard
              title="Cache + DB fanout"
              subtitle="latency + hit rate observability"
              variant="red"
              className="right-2 top-20 z-10 hidden rotate-[7deg] opacity-90 lg:block"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          See your designs in action
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-relaxed text-zinc-400">
          RunCloud9 provides an interactive environment to design an
          architecture, deploy it, and watch it perform under real load.
          Configure your components, click deploy, and see a live system spin up
          on Kubernetes. Then trigger traffic and chaos events. Observe how
          latency, caching, and connection pools react to sudden traffic spikes.
          Experience system behavior firsthand.
        </p>
      </section>

      <section className="border-y border-zinc-800/80 bg-zinc-900/30">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Design on a live canvas',
              body: 'Drop components and draw connections. Assemble load balancers, app servers, databases, and caches in a view that maps directly to what gets deployed.',
            },
            {
              title: 'Deploy to real Kubernetes',
              body: 'One click provisions your entire architecture on live infrastructure.',
            },
            {
              title: 'Watch it break under load',
              body: 'A built-in load generator hammers your architecture with configurable RPS and exposes P50/P95/P99, cache hit rates, and saturation in real time.',
            },
            {
              title: 'Session summary',
              body: 'Every session ends with a performance breakdown including peak RPS, latency distribution, cache effectiveness, and saturation ratios.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.9)]"
            >
              <h3 className="text-base font-semibold text-zinc-100">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Start with battle-tested patterns
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-relaxed text-zinc-400">
          Each template is a real architecture, pre-configured and pre-seeded.
          Explore canonical read-heavy workloads, fan-out event architectures,
          and more.
        </p>
      </section>

      {SHOW_DEMO_VIDEO ? (
        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h2 className="text-2xl font-semibold text-zinc-100">Product demo</h2>
            <p className="mt-3 text-sm text-zinc-400">
              Demo video embed goes here.
            </p>
          </div>
        </section>
      ) : null}

      <section className="border-t border-zinc-800/80">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Built for engineers who learn by doing
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              {
                title: 'Interview prep',
                body: 'Deploy common system-design patterns and understand real trade-offs before interview day.',
              },
              {
                title: 'Distributed systems intuition',
                body: 'Watch cache hit rates, latency percentiles, and bottlenecks shift under realistic load.',
              },
              {
                title: 'Platform and SRE learning',
                body: 'Practice Kubernetes deployment, load generation, teardown, and troubleshooting in a controlled loop.',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
              >
                <h3 className="text-base font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-cyan-700/40 bg-cyan-950/20 p-8 text-center">
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
              The next time someone asks what happens when your cache goes down
            </h3>
            <p className="mt-3 text-base text-zinc-300">
              you will have actually watched it happen.
            </p>
            <Link
              to="/canvas"
              className="mt-7 inline-flex rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400"
            >
              Deploy your architecture →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
