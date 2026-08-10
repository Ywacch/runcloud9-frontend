import canvasDesign from '../../assets/canvas-hero.svg'
import canvasDeploy from '../../assets/canvas1.PNG'
import canvasObserve from '../../assets/canvas3.png'
import { ScreenshotFrame } from './ScreenshotFrame'

type FeatureBlockConfig = {
  category: string
  categoryClass: string
  title: string
  body: string
  bullets: string[]
  screenshotSrc: string
  visualFirst: boolean
}

const FEATURE_BLOCKS: FeatureBlockConfig[] = [
  {
    category: 'Design',
    categoryClass: 'text-c9-success',
    title: 'Lay out the system',
    body: 'Add components to the canvas. Configure & connect components, and deploy from the same view.',
    bullets: [
      'Six component types: load balancer, app server, database, cache, message queue, worker',
      'Draw connections on the canvas to model how traffic should flow',
      'Horizontal scaling via replicas; vertical via CPU and memory',
    ],
    screenshotSrc: canvasDesign,
    visualFirst: true,
  },
  {
    category: 'Deploy',
    categoryClass: 'text-c9-info',
    title: 'Deploy the full diagram',
    body: 'One click provisions the components in your drawing as live services with namespace isolation and resource quotas. The session runs nine minutes, then teardown reclaims the environment.',
    bullets: [
      'Deploy the full diagram with one click from the canvas',
      'Templates include seeded database rows for realistic reads',
      'Teardown runs when the session clock ends',
    ],
    screenshotSrc: canvasDeploy,
    visualFirst: false,
  },
  {
    category: 'Observe',
    categoryClass: 'text-c9-warning',
    title: 'Read metrics on the diagram',
    body: 'Prometheus metrics stream to the nodes on your canvas. You see p99 latency, cache hit rate, database query rate, and errors on the component that produced them. Trigger chaos scenarios during a live session and watch the same metrics move on the nodes that fail.',
    bullets: [
      'Per-component CPU, memory, and request rate',
      'Cache flush and pod kill scenarios you trigger from the live session',
      'Cache hit and miss counters',
      'Threshold events with topology suggestions',
    ],
    screenshotSrc: canvasObserve,
    visualFirst: true,
  },
]

function FeatureVisual({
  screenshotSrc,
  alt,
  framed = true,
}: {
  screenshotSrc: string
  alt?: string
  framed?: boolean
}) {
  if (!framed) {
    return (
      <div className="relative w-full overflow-hidden">
        <img
          src={screenshotSrc}
          alt={alt ?? ''}
          className="mx-auto block h-auto w-full max-w-2xl object-contain select-none"
          style={{
            maskImage:
              'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 78%)',
          }}
          decoding="async"
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div
        className="absolute inset-4 z-0 rounded-xl blur-2xl"
        style={{ background: 'rgba(89, 73, 122, 0.12)' }}
        aria-hidden
      />
      <div
        className="relative z-10"
        style={{ filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.5))' }}
      >
        <ScreenshotFrame
          screenshotSrc={screenshotSrc}
          alt={alt}
          className="w-full"
        />
      </div>
    </div>
  )
}

function FeatureCopy({
  title,
  body,
  bullets,
}: Pick<FeatureBlockConfig, 'title' | 'body' | 'bullets'>) {
  return (
    <div>
      <h3 className="whitespace-pre-line font-serif text-3xl font-medium leading-snug text-c9-text-heading lg:text-4xl">
        {title}
      </h3>
      <p className="mt-4 max-w-[65ch] font-serif text-base leading-relaxed text-c9-text-muted">
        {body}
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3">
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-c9-accent"
              aria-hidden
            />
            <span className="text-sm leading-relaxed text-c9-text">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function featureAlt(block: FeatureBlockConfig) {
  return block.category === 'Design'
    ? 'RunCloud9 isometric architecture canvas'
    : `${block.title} preview`
}

export function Features() {
  return (
    <section
      id="features"
      className="bg-[#08070c] px-6 py-16 text-[var(--c9-text)] lg:px-10"
    >
      <div className="mx-auto max-w-[1360px]">
        <header className="mb-12 max-w-3xl">
          <h2 className="font-serif text-4xl font-medium tracking-[-0.02em] text-c9-text-heading lg:text-5xl">
            Live infrastructure from your canvas diagram.
          </h2>
          <p className="mt-4 max-w-[65ch] font-serif text-lg leading-relaxed text-c9-text-muted">
            You deploy what you placed on the canvas, run traffic for nine
            minutes, trigger chaos scenarios, and read metrics on each node.
          </p>
        </header>
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
          <nav
            className="w-[13.3rem] shrink-0 lg:sticky lg:top-24"
            aria-label="Session steps"
          >
            <ol className="flex flex-row gap-4 lg:flex-col lg:gap-1">
              {FEATURE_BLOCKS.map((block, i) => (
                <li key={block.category}>
                  <a
                    href={`#feature-${block.category.toLowerCase()}`}
                    className={`block rounded-md px-2 py-2 text-sm text-c9-text-muted transition-colors hover:text-c9-text-heading focus-visible:shadow-[var(--c9-shadow-focus)] focus-visible:outline-none ${block.categoryClass}`}
                  >
                    <span className="font-mono text-[11px] text-c9-text-disabled">
                      {String(i + 1).padStart(2, '0')}
                    </span>{' '}
                    {block.category}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-14">
            {FEATURE_BLOCKS.map((block) => (
              <article
                key={block.category}
                id={`feature-${block.category.toLowerCase()}`}
                className="border-t border-[var(--c9-border)] py-10"
              >
                <FeatureCopy
                  title={block.title}
                  body={block.body}
                  bullets={block.bullets}
                />
                <div className="mt-8">
                  <FeatureVisual
                    screenshotSrc={block.screenshotSrc}
                    framed={block.category !== 'Design'}
                    alt={featureAlt(block)}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
