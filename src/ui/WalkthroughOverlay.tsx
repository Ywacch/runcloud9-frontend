import { useMemo } from 'react'
import { useWalkthroughKeyboard } from '../hooks/useWalkthroughKeyboard'
import { useWalkthroughTimer } from '../hooks/useWalkthroughTimer'
import { journeyStepHeading } from '../lib/requestJourney'
import { useCanvasStore } from '../store/canvasStore'
import {
  useWalkthroughStore,
  type WalkthroughSpeed,
} from '../store/walkthroughStore'

const SPEEDS: WalkthroughSpeed[] = [0.5, 1, 1.5, 2]

const COMPONENT_BADGE: Record<string, string> = {
  lb: 'LB',
  'app-server': 'APP',
  cache: 'CACHE',
  db: 'DB',
  mq: 'MQ',
  worker: 'WORKER',
}

export function WalkthroughOverlay() {
  const activeJourneyId = useWalkthroughStore((s) => s.activeJourneyId)
  const journey = useWalkthroughStore((s) => s.journey)
  const currentStepIndex = useWalkthroughStore((s) => s.currentStepIndex)
  const playing = useWalkthroughStore((s) => s.playing)
  const speed = useWalkthroughStore((s) => s.speed)
  const stop = useWalkthroughStore((s) => s.stop)
  const nextStep = useWalkthroughStore((s) => s.nextStep)
  const prevStep = useWalkthroughStore((s) => s.prevStep)
  const goToStep = useWalkthroughStore((s) => s.goToStep)
  const setPlaying = useWalkthroughStore((s) => s.setPlaying)
  const setSpeed = useWalkthroughStore((s) => s.setSpeed)
  const mode = useCanvasStore((s) => s.mode)

  useWalkthroughTimer()
  useWalkthroughKeyboard(Boolean(activeJourneyId))

  const step = journey?.steps[currentStepIndex]
  const stepCount = journey?.steps.length ?? 0
  const progressPct = stepCount > 1 ? (currentStepIndex / (stepCount - 1)) * 100 : 100

  const heading = useMemo(() => {
    if (!step) return ''
    return journeyStepHeading(step, currentStepIndex)
  }, [step, currentStepIndex])

  if (!activeJourneyId || !journey || mode !== 'design') return null

  const badge = step ? COMPONENT_BADGE[step.component] ?? step.component.toUpperCase() : ''
  const atLast = currentStepIndex >= stepCount - 1

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[35] max-h-[min(42vh,22rem)] overflow-y-auto border-t border-cyan-500/30 bg-[var(--c9-surface)]/95 px-4 py-3 pb-4 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/90">
          Architecture walkthrough
        </p>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
              {badge}
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-[var(--c9-muted)]">
            {journey.method} {journey.path}
          </span>
          <button
            type="button"
            onClick={stop}
            className="rounded border border-[var(--c9-border)] px-2 py-0.5 text-[10px] text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
            aria-label="Close walkthrough"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          title="Restart"
          onClick={() => goToStep(0)}
          className="rounded border border-[var(--c9-border)] px-2 py-1 text-xs hover:bg-[var(--c9-badge-bg)]"
        >
          ⟲
        </button>
        <button
          type="button"
          title="Previous step"
          onClick={prevStep}
          disabled={currentStepIndex <= 0}
          className="rounded border border-[var(--c9-border)] px-2 py-1 text-xs hover:bg-[var(--c9-badge-bg)] disabled:opacity-40"
        >
          ◀
        </button>
        <button
          type="button"
          title={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying(!playing)}
          className="rounded border border-cyan-500/50 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          title="Next step"
          onClick={nextStep}
          disabled={atLast}
          className="rounded border border-[var(--c9-border)] px-2 py-1 text-xs hover:bg-[var(--c9-badge-bg)] disabled:opacity-40"
        >
          ▶
        </button>
        <div className="ml-auto flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-0.5 text-[10px] font-mono ${
                speed === s
                  ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/50'
                  : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <span className="text-[10px] tabular-nums text-[var(--c9-muted)]">
          {currentStepIndex + 1} / {stepCount}
        </span>
      </div>

      <div className="mb-2 flex gap-1">
        {journey.steps.map((_, i) => (
          <button
            key={i}
            type="button"
            title={`Go to step ${i + 1}`}
            onClick={() => goToStep(i)}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === currentStepIndex
                ? 'bg-cyan-400'
                : i < currentStepIndex
                  ? 'bg-cyan-700/60'
                  : 'bg-[var(--c9-border)]'
            }`}
          />
        ))}
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--c9-border)]">
        <div
          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {step ? (
        <>
          <p className="text-sm font-semibold text-[var(--c9-text)]">{heading}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{step.action}</p>
          {step.detail ? (
            <pre className="mt-2 overflow-x-auto rounded bg-black/35 p-2 font-mono text-[11px] text-zinc-300">
              {step.detail}
            </pre>
          ) : null}
        </>
      ) : null}

      {journey.explanation ? (
        <div className="mt-3 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
            Why this matters
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">{journey.explanation}</p>
        </div>
      ) : null}
    </div>
  )
}
