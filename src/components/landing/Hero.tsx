import { Link } from 'react-router-dom'
import canvasHero from '../../assets/canvas1.PNG'
import { trackEvent } from '../../lib/analytics'
import { ScreenshotFrame } from './ScreenshotFrame'

const GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

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

      <div className="relative z-10 mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-16 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
        <div className="flex flex-col justify-center gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-c9-accent/30 bg-c9-accent-subtle px-3 py-1 text-xs font-medium text-c9-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-c9-accent" aria-hidden />
            Systems architecture lab
          </span>

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
              onClick={() => trackEvent('landing_cta_clicked', { ctaName: 'start_building' })}
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
          <div className="relative mx-auto w-full max-w-lg">
            <div
              className="absolute inset-4 z-0 rounded-xl blur-2xl"
              style={{ background: 'rgba(89, 73, 122, 0.12)' }}
              aria-hidden
            />
            <div
              className="relative z-10"
              style={{ filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.5))' }}
            >
              <ScreenshotFrame screenshotSrc={canvasHero} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
