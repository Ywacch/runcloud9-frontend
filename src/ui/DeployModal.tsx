import { DeployProgressSteps, type DeployStep } from './DeployProgressSteps'

export type { DeployStep }

export type DeployModalMode =
  | 'progress'
  | 'request_rejected'
  | 'simulation_recommended'

interface Props {
  open: boolean
  steps: DeployStep[]
  mode?: DeployModalMode
  requestTitle?: string | null
  requestMessage?: string | null
  technicalDetails?: string | null
  requestActionLabel?: string | null
  onRequestAction?: () => void
  /** Backend returned simulation_recommended — no deployment was created. */
  simulationRecommended?: string | null
  onClose?: () => void
  onSimulateDesign?: () => void
  onModifyDesign?: () => void
}

export function DeployModal({
  open,
  steps,
  mode = 'progress',
  requestTitle,
  requestMessage,
  technicalDetails,
  requestActionLabel,
  onRequestAction,
  simulationRecommended,
  onClose,
  onSimulateDesign,
  onModifyDesign,
}: Props) {
  if (!open) return null

  const showSimulation =
    mode === 'simulation_recommended' && Boolean(simulationRecommended)
  const showRequestRejected = mode === 'request_rejected'
  const showProgress = mode === 'progress'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-[var(--c9-text)]">
          {showSimulation
            ? 'Simulation recommended'
            : showRequestRejected
              ? requestTitle || 'Deployment request was not accepted'
              : 'Deploying Infrastructure'}
        </h2>

        {showSimulation ? (
          <div className="mb-4 rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-3 text-sm">
            <p className="text-xs text-purple-100/90">{simulationRecommended}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSimulateDesign?.()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-violet-500"
              >
                Simulate this design
              </button>
              <button
                type="button"
                onClick={() => onModifyDesign?.()}
                className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
              >
                Modify design
              </button>
            </div>
          </div>
        ) : null}

        {showProgress ? <DeployProgressSteps steps={steps} /> : null}

        {showRequestRejected ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--c9-text)]">
              {requestMessage || 'Please try again.'}
            </p>
            {technicalDetails ? (
              <details className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)]/50 px-3 py-2">
                <summary className="cursor-pointer text-xs text-[var(--c9-muted)]">
                  Technical details
                </summary>
                <p className="mt-2 break-words text-xs text-[var(--c9-muted)]">
                  {technicalDetails}
                </p>
              </details>
            ) : null}
          </div>
        ) : null}

        {showRequestRejected && requestActionLabel && onRequestAction ? (
          <button
            type="button"
            onClick={onRequestAction}
            className="mt-4 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)]"
          >
            {requestActionLabel}
          </button>
        ) : null}

        {showRequestRejected && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
          >
            Dismiss
          </button>
        ) : null}

        {!showProgress && !showRequestRejected && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
          >
            Close
          </button>
        ) : null}

        {showProgress && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
          >
            Hide
          </button>
        ) : null}
      </div>
    </div>
  )
}
