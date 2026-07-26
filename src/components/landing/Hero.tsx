import { Link } from 'react-router-dom'
import { trackEvent } from '../../lib/analytics'
import { InteractiveCanvasHero } from './InteractiveCanvasHero'

const GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const HERO_SVG_STYLE = {
  filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.45))',
  maskImage:
    'radial-gradient(ellipse 88% 88% at 50% 50%, black 62%, transparent 92%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 88% 88% at 50% 50%, black 62%, transparent 92%)',
} as const

export function Hero() {
  return (
    <section
      className="relative flex min-h-screen items-center overflow-hidden pt-14"
      style={{ background: '#08070C' }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 70% 80% at 75% 50%, rgba(89,73,122,0.28) 0%, rgba(89,73,122,0.10) 45%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: GRAIN_BG }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[1360px] grid-cols-1 items-center gap-16 px-6 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:px-10 lg:py-24">
        <div className="flex flex-col justify-center gap-6">
          <h1 className="font-serif text-4xl font-medium leading-tight text-c9-text-heading md:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
            Design and deploy live architecture on a canvas.
          </h1>

          <p className="max-w-md text-lg leading-relaxed text-c9-text-muted">
            Place load balancers, app servers, databases, caches, and queues on
            the canvas. One deploy spins up a live stack. Metrics display for
            each node while traffic runs for 9 minutes.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/canvas"
              onClick={() =>
                trackEvent('landing_cta_clicked', { ctaName: 'start_building' })
              }
              className="rounded bg-c9-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-c9-accent-hover active:scale-[0.98]"
            >
              Start Building →
            </Link>
            <a
              href="#features"
              className="rounded border border-c9-border-strong px-6 py-2.5 text-sm text-c9-text transition-colors hover:border-c9-accent hover:text-c9-accent active:scale-[0.98]"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="relative flex w-full items-center justify-center">
          <div className="group relative mx-auto w-full cursor-default lg:w-[118%] lg:max-w-none lg:-mr-[12%]">
            <div
              className="pointer-events-none absolute inset-8 z-0 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: 'rgba(89, 73, 122, 0.16)' }}
              aria-hidden
            />
            <InteractiveCanvasHero
              className="relative z-10 transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-3"
              imgStyle={HERO_SVG_STYLE}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
