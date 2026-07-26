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
  category,
  categoryClass,
  title,
  body,
  bullets,
}: Pick<FeatureBlockConfig, 'category' | 'categoryClass' | 'title' | 'body' | 'bullets'>) {
  return (
    <div>
      <p
        className={`text-xs font-medium uppercase tracking-widest ${categoryClass}`}
      >
        {category}
      </p>
      <h3 className="mt-3 whitespace-pre-line font-serif text-3xl font-medium leading-snug text-c9-text-heading lg:text-4xl">
        {title}
      </h3>
      <p className="mt-4 max-w-md text-base leading-relaxed text-c9-text-muted">
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

export function Features() {
  return (
    <section
      id="features"
      className="py-32"
      style={{ background: '#08070C' }}
    >
      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        <header className="mb-20 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-c9-accent">
            What you can do
          </p>
          <h2 className="mt-3 font-serif text-4xl font-medium text-c9-text-heading lg:text-5xl">
            Live infrastructure from your canvas diagram.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-c9-text-muted">
            You deploy what you placed on the canvas, run traffic for nine
            minutes, trigger chaos scenarios, and read metrics on each node.
          </p>
        </header>

        <div className="flex flex-col">
          {FEATURE_BLOCKS.map((block) => (
            <article
              key={block.category}
              className="grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-12 lg:gap-16"
              style={{ borderTop: '1px solid var(--c9-border)' }}
            >
              {block.visualFirst ? (
                <>
                  <div className="lg:col-span-8 lg:order-1">
                    <FeatureVisual
                      screenshotSrc={block.screenshotSrc}
                      framed={block.category === 'Design' ? false : true}
                      alt={
                        block.category === 'Design'
                          ? 'RunCloud9 isometric architecture canvas'
                          : `${block.title} preview`
                      }
                    />
                  </div>
                  <div className="lg:col-span-4 lg:order-2">
                    <FeatureCopy
                      category={block.category}
                      categoryClass={block.categoryClass}
                      title={block.title}
                      body={block.body}
                      bullets={block.bullets}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="lg:col-span-4 lg:order-1">
                    <FeatureCopy
                      category={block.category}
                      categoryClass={block.categoryClass}
                      title={block.title}
                      body={block.body}
                      bullets={block.bullets}
                    />
                  </div>
                  <div className="lg:col-span-8 lg:order-2">
                    <FeatureVisual
                      screenshotSrc={block.screenshotSrc}
                      alt={`${block.title} preview`}
                    />
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
