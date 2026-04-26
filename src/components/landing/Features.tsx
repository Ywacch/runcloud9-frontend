import { type ReactNode } from 'react'
import canvasDesign from '../../assets/canvas2.PNG'
import canvasLive from '../../assets/canvas3.png'
import { ScreenshotFrame } from './ScreenshotFrame'

type FeatureItem = {
  id: number
  tag: string
  headline: string
  body: string
  align: 'left' | 'right'
  badgeClassName: string
  icon: ReactNode
}

const FEATURES: FeatureItem[] = [
  {
    id: 1,
    tag: 'Visual Topology Canvas',
    headline: 'Design your architecture, see your drawings in action',
    body: 'RunCloud9 provides an interactive environment to design an architecture, deploy it, and watch it perform under real load. Configure your components, click deploy, and see a live system spin up on Kubernetes. Then trigger traffic and chaos events. Observe how latency, caching, and connection pools react to sudden traffic spikes. Experience system behavior firsthand.',
    align: 'right',
    badgeClassName:
      'bg-[var(--c9-badge-bg)] text-[var(--c9-badge-text)] border-indigo-500/20',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: 2,
    tag: 'Real-Time Observation',
    headline: 'Watch your decisions play out, live.',
    body: 'Every change you make on the canvas reflects in real time. Bottlenecks surface, request traces light up, node health shifts as load moves through your system.',
    align: 'left',
    badgeClassName: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12h3l2-5 4 10 2-5h7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

const LIVE_SECTION_POINTS: {
  title: string
  body: string
  comingSoon?: boolean
}[] = [
  {
    title: 'Build real architectures in minutes',
    body: 'Start from scratch or pick a template. Drop components onto the canvas, configure how each one behaves, and deploy a live system with a few clicks.',
  },
  {
    title: 'See what your decisions actually cost',
    body: 'Trigger traffic, introduce failures, and watch latency, throughput, and service health respond in real time. Learn by breaking things safely.',
  },
  {
    title: 'Collaborate and share',
    body: 'Review architectures together, compare approaches, and build a shared understanding of how your systems work.',
    comingSoon: true,
  },
]

export function Features() {
  return (
    <section id="features">
      {FEATURES.map((feature, i) => {
        if (feature.id === 2) {
          return (
            <div key={feature.id} className="bg-[var(--c9-surface)] py-24">
              <div className="mx-auto max-w-7xl px-6">
                <span
                  className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${feature.badgeClassName}`}
                >
                  {feature.icon}
                  {feature.tag}
                </span>
                <h3 className="mb-4 text-3xl font-semibold leading-tight text-[var(--c9-text)]">
                  {feature.headline}
                </h3>
                <p className="mb-8 max-w-3xl leading-relaxed text-[var(--c9-muted)]">
                  {feature.body}
                </p>

                <div className="rounded-2xl border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-3 shadow-xl shadow-black/10">
                  <ScreenshotFrame className="w-full" screenshotSrc={canvasLive} />
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-3">
                  {LIVE_SECTION_POINTS.map((point) => (
                    <article
                      key={point.title}
                      className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="text-xl font-semibold text-[var(--c9-text)]">
                          {point.title}
                        </h4>
                        {point.comingSoon ? (
                          <span className="shrink-0 rounded-full border border-[var(--c9-border)] bg-[var(--c9-badge-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-badge-text)]">
                            Coming soon
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--c9-muted)]">
                        {point.body}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )
        }

        const sectionBg = i % 2 === 0 ? 'bg-[var(--c9-bg)]' : 'bg-[var(--c9-surface)]'
        const visualOrderClass = feature.align === 'left' ? 'lg:order-2' : ''
        const textOrderClass = feature.align === 'left' ? 'lg:order-1' : ''
        return (
          <div key={feature.id} className={`py-24 ${sectionBg}`}>
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
              <div className={textOrderClass}>
                <span
                  className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${feature.badgeClassName}`}
                >
                  {feature.icon}
                  {feature.tag}
                </span>
                <h3 className="mb-4 text-3xl font-semibold leading-tight text-[var(--c9-text)]">
                  {feature.headline}
                </h3>
                <p className="leading-relaxed text-[var(--c9-muted)]">
                  {feature.body}
                </p>
              </div>
              <div className={visualOrderClass}>
                <ScreenshotFrame className="w-full" screenshotSrc={canvasDesign} />
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
