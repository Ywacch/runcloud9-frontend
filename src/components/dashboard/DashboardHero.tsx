import { Link } from 'react-router-dom'
import { InteractiveCanvasHero } from '../landing/InteractiveCanvasHero'

/** Full landing SVG, scaled down for the dashboard header. */
const DASHBOARD_SVG_STYLE = {
  width: '100%',
  height: 'auto',
  display: 'block',
} as const

export function DashboardHero() {
  return (
    <section>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/canvas"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c9-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c9-bg)] active:scale-[0.98]"
        >
          Open canvas
        </Link>
        <div className="w-full max-w-[240px] sm:max-w-[280px]">
          <InteractiveCanvasHero
            className="w-full"
            imgStyle={DASHBOARD_SVG_STYLE}
          />
        </div>
      </div>
    </section>
  )
}
