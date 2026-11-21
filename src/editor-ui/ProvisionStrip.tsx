import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useProvisionFloorStore } from '../editor-core/stores/provisionFloorStore'
import {
  formatProvisionStripClock,
  provisionStripCopy,
} from '../lib/provisionFloorVisual'

export function ProvisionStrip({
  onCancel,
  onDismissError,
}: {
  onCancel?: () => void
  onDismissError?: () => void
}) {
  const nodes = useCanvasStore((s) => s.nodes)
  const active = useProvisionFloorStore((s) => s.active)
  const preview = useProvisionFloorStore((s) => s.preview)
  const parsed = useProvisionFloorStore((s) => s.parsed)
  const elapsedSeconds = useProvisionFloorStore((s) => s.elapsedSeconds)
  const isQueued = useProvisionFloorStore((s) => s.isQueued)
  const isTerminating = useProvisionFloorStore((s) => s.isTerminating)
  const submitting = useProvisionFloorStore((s) => s.submitting)
  const queuePosition = useProvisionFloorStore((s) => s.queuePosition)
  const estimatedWaitSeconds = useProvisionFloorStore((s) => s.estimatedWaitSeconds)
  const error = useProvisionFloorStore((s) => s.error)

  if (!active) return null

  const copy = provisionStripCopy({
    parsed,
    nodes,
    elapsedSeconds,
    isQueued,
    isTerminating,
    isSubmitting: submitting,
    queuePosition,
    estimatedWaitSeconds,
    error,
  })

  const dotClass =
    copy.phase === 'teardown'
      ? 'bg-[var(--dt-color-text-muted)]'
      : copy.phase === 'error'
        ? 'bg-[var(--dt-color-red)]'
        : 'bg-[var(--dt-color-blue)] motion-safe:animate-pulse'
  const txtBtn =
    'cv-txt pointer-events-auto h-[22px] shrink-0 rounded-[7px] border-0 bg-transparent px-1.5 text-[12px] text-[var(--dt-color-text-muted)] hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dt-color-focus)] disabled:opacity-45'

  return (
    <div
      className="cv-provision-strip cv-strip pointer-events-none absolute inset-x-0 top-0 z-[6] flex! h-[34px]! items-center! gap-2.5! whitespace-nowrap! border-b! border-[var(--dt-color-divider-inset)]! bg-[rgba(22,20,32,0.86)]! py-0! pr-2.5! pl-4! text-[12px]! text-[var(--dt-color-text)]!"
      data-phase={copy.phase}
      data-preview={preview ? '1' : undefined}
    >
      <span className={`cv-st-dot size-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <p className="cv-provision-strip-step cv-st-step m-0! min-w-0 truncate text-[12px]! font-normal! text-white!">{copy.step}</p>
      <span className="cv-provision-strip-clock cv-st-time shrink-0 tabular-nums text-[var(--dt-color-text-muted)]">
        {formatProvisionStripClock(elapsedSeconds)}
      </span>
      {copy.estimate ? (
        <p className="cv-provision-strip-est cv-st-est m-0! min-w-0 truncate text-[12px]! text-[var(--dt-color-text-muted)]! before:mr-2.5 before:content-['·']">
          {copy.estimate}
        </p>
      ) : null}
      <span className="cv-st-sp min-w-0 flex-1" />
      {copy.phase === 'error' ? (
        <button type="button" className={txtBtn} onClick={onDismissError}>
          Back to canvas
        </button>
      ) : preview ? (
        <span className="cv-provision-strip-est shrink-0 text-[var(--dt-color-text-muted)]">DEV preview</span>
      ) : (
        <button type="button" className={txtBtn} onClick={onCancel} disabled={isTerminating}>
          {isTerminating ? 'Stopping…' : 'Cancel'}
        </button>
      )}
    </div>
  )
}
