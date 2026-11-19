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

  return (
    <div
      className="cv-provision-strip pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center gap-3 px-3 py-2"
      data-phase={copy.phase}
      data-preview={preview ? '1' : undefined}
    >
      <div className="min-w-0 flex-1">
        <p className="cv-provision-strip-step truncate">{copy.step}</p>
        {copy.estimate ? (
          <p className="cv-provision-strip-est truncate">{copy.estimate}</p>
        ) : null}
      </div>
      <span className="cv-provision-strip-clock shrink-0 tabular-nums">
        {formatProvisionStripClock(elapsedSeconds)}
      </span>
      {copy.phase === 'error' ? (
        <button
          type="button"
          className="pointer-events-auto cv-provision-strip-btn shrink-0"
          onClick={onDismissError}
        >
          Back to canvas
        </button>
      ) : preview ? (
        <span className="cv-provision-strip-est shrink-0">DEV preview</span>
      ) : (
        <button
          type="button"
          className="pointer-events-auto cv-provision-strip-btn shrink-0"
          onClick={onCancel}
          disabled={isTerminating}
        >
          {isTerminating ? 'Stopping…' : 'Cancel'}
        </button>
      )}
    </div>
  )
}
