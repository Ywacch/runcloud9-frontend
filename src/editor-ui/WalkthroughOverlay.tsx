import { useMemo } from 'react'
import { useWalkthroughKeyboard } from '../editor-core/hooks/useWalkthroughKeyboard'
import { useWalkthroughTimer } from '../editor-core/hooks/useWalkthroughTimer'
import { journeyStepHeading } from '../lib/requestJourney'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  WalkthroughDiagram,
  resolveWalkthroughDiagramSpec,
} from '../components/walkthrough/WalkthroughDiagram'
import { SqlDetailBlock } from './SqlDetailBlock'
import {
  useWalkthroughStore,
  type WalkthroughSpeed,
} from '../editor-core/stores/walkthroughStore'

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

  const whyThisMatters = useMemo(() => {
    if (!journey || !step) return ''
    const stepCount = journey.steps.length
    const isLast = currentStepIndex >= stepCount - 1
    return (
      step.lesson?.trim() ||
      (isLast ? journey.explanation?.trim() ?? '' : '')
    )
  }, [journey, step, currentStepIndex])

  const diagramSpec = useMemo(() => {
    if (!journey) return null
    return resolveWalkthroughDiagramSpec(journey.id, journey.steps)
  }, [journey])

  if (!activeJourneyId || !journey || mode !== 'design') return null

  const badge = step ? COMPONENT_BADGE[step.component] ?? step.component.toUpperCase() : ''
  const atLast = currentStepIndex >= stepCount - 1

  return (
    <div
      className={`cv-walk pointer-events-auto absolute bottom-4 left-4 z-[6] w-[360px] overflow-y-auto rounded-[10px] border border-[var(--dt-color-divider-inset)] bg-[var(--dt-color-surface)] px-3.5 pt-2.5 pb-2 text-[12px] text-[var(--dt-color-text)] shadow-[0_22px_44px_rgba(2,3,22,0.45)] ${
        diagramSpec ? 'max-h-[min(58vh,34rem)]' : 'max-h-[min(42vh,22rem)]'
      }`}
      data-playing={playing ? 'true' : 'false'}
    >
      <header className="cv-walk-hd mb-1.5 flex items-center gap-1.5">
        <p className="cv-walk-k m-0 min-w-0 flex-1 truncate text-[11px] font-medium tracking-[0.6px] text-[var(--dt-color-text-muted)] uppercase">
          Walk a request
        </p>
        {badge ? (
          <span className="shrink-0 font-[family-name:var(--dt-font-family-mono)] text-[10.5px] text-[var(--dt-color-text-muted)]">
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={stop}
          className="cv-x ml-auto grid size-[22px] place-items-center rounded-[7px] border-0 bg-transparent text-[var(--dt-color-text-muted)] hover:bg-white/5 hover:text-white"
          aria-label="Close walkthrough"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <p className="mb-[3px] flex justify-between text-[11px] font-medium tracking-[0.6px] text-[var(--dt-color-text-muted)] uppercase">
        <span className="min-w-0 truncate normal-case tracking-normal text-[13px] font-medium text-white">
          {journey.method} {journey.path}
        </span>
        <span className="cv-walk-tot shrink-0 text-[var(--dt-color-text)] normal-case tracking-normal tabular-nums">
          {currentStepIndex + 1} / {stepCount}
        </span>
      </p>

      {step ? (
        <>
          <p className="cv-walk-say m-0 text-[13px] leading-[1.45] text-white">{heading}</p>
          <p className="cv-walk-then mt-0.5 leading-[1.45] text-[var(--dt-color-text-muted)]">{step.action}</p>
          {step.detail ? <SqlDetailBlock sql={step.detail} /> : null}
        </>
      ) : null}

      {whyThisMatters ? (
        <p className="mt-0.5 leading-[1.45] text-[var(--dt-color-text-muted)]">{whyThisMatters}</p>
      ) : null}

      {diagramSpec ? (
        <WalkthroughDiagram
          spec={diagramSpec}
          journeyId={journey.id}
          currentStepIndex={currentStepIndex}
          playbackSpeed={speed}
          className="mt-2 border-t border-[var(--dt-color-divider-inset)]"
        />
      ) : null}

      <div className="cv-walk-ctl mt-[9px] flex items-center gap-0.5 border-t border-[var(--dt-color-divider-inset)] pt-2">
        <button
          type="button"
          title="Previous step"
          aria-label="Previous step"
          onClick={prevStep}
          disabled={currentStepIndex <= 0}
          className="cv-ib grid h-[22px] w-6 place-items-center rounded-[7px] border-0 bg-transparent text-[var(--dt-color-text)] hover:bg-white/5 hover:text-white disabled:opacity-35"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>
        <button
          type="button"
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying(!playing)}
          className="cv-ib grid h-[22px] w-6 place-items-center rounded-[7px] border-0 bg-transparent text-[var(--dt-color-text)] hover:bg-white/5 hover:text-white"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M5 3.5v9M11 3.5v9" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M5.5 3.8v8.4l6.6-4.2z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          title="Next step"
          aria-label="Next step"
          onClick={nextStep}
          disabled={atLast}
          className="cv-ib grid h-[22px] w-6 place-items-center rounded-[7px] border-0 bg-transparent text-[var(--dt-color-text)] hover:bg-white/5 hover:text-white disabled:opacity-35"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
        <button
          type="button"
          title="Restart"
          aria-label="Restart"
          onClick={() => goToStep(0)}
          className="h-[22px] rounded-[7px] border-0 bg-transparent px-1 text-[11px] text-[var(--dt-color-text-muted)] hover:bg-white/5 hover:text-white"
        >
          Restart
        </button>
        <span className="cv-walk-spd ml-1 flex">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`h-[22px] rounded-[7px] border-0 bg-transparent px-[5px] text-[11px] tabular-nums ${
                speed === s
                  ? 'text-white'
                  : 'text-[var(--dt-color-text-muted)] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </span>
        <ol
          className="cv-walk-seg ml-1 flex min-w-0 flex-1 list-none gap-[3px] p-0"
          aria-label="Steps"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
        >
          {journey.steps.map((_, i) => (
            <li key={i} className={i === journey.steps.length - 1 ? 'flex min-w-0 flex-[0.5]' : 'flex min-w-0 flex-1'}>
              <button
                type="button"
                title={`Go to step ${i + 1}`}
                onClick={() => goToStep(i)}
                data-s={i === currentStepIndex ? 'on' : i < currentStepIndex ? 'past' : 'future'}
                className="relative h-3.5 w-full border-0 bg-transparent"
              >
                <span
                  className={`absolute inset-x-0 top-1.5 h-0.5 rounded-sm ${
                    i === currentStepIndex
                      ? 'bg-[var(--dt-color-primary)]'
                      : i < currentStepIndex
                        ? 'bg-[var(--dt-color-text-muted)] opacity-70'
                        : 'bg-[var(--dt-color-divider-inset)]'
                  }`}
                />
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
