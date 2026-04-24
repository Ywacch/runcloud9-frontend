export type DeployStep = {
  id: string
  label: string
  state: 'pending' | 'active' | 'done' | 'error'
  detail?: string
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {showSimulation
            ? 'Simulation recommended'
            : showRequestRejected
              ? requestTitle || 'Deployment request was not accepted'
              : 'Deploying Infrastructure'}
        </h2>

        {showSimulation ? (
          <div className="mb-4 rounded-lg border border-purple-600/40 bg-purple-950/35 px-3 py-3 text-sm">
            <p className="text-xs text-purple-100/90">{simulationRecommended}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSimulateDesign?.()}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
              >
                Simulate this design
              </button>
              <button
                type="button"
                onClick={() => onModifyDesign?.()}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700"
              >
                Modify design
              </button>
            </div>
          </div>
        ) : null}

        {showProgress ? (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {step.state === 'done' ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                      <span className="text-xs text-emerald-400">✓</span>
                    </div>
                  ) : step.state === 'active' ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    </div>
                  ) : step.state === 'error' ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
                      <span className="text-xs text-red-400">✕</span>
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-700">
                      <span className="text-xs text-gray-600">{i + 1}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      step.state === 'active'
                        ? 'text-white'
                        : step.state === 'done'
                          ? 'text-gray-400'
                          : step.state === 'error'
                            ? 'text-red-400'
                            : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </div>
                  {step.detail ? (
                    <div className="mt-0.5 text-xs text-gray-500">{step.detail}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {showRequestRejected ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-200">
              {requestMessage || 'Please try again.'}
            </p>
            {technicalDetails ? (
              <details className="rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2">
                <summary className="cursor-pointer text-xs text-gray-300">
                  Technical details
                </summary>
                <p className="mt-2 break-words text-xs text-gray-400">
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
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            {requestActionLabel}
          </button>
        ) : null}

        {showRequestRejected && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Dismiss
          </button>
        ) : null}

        {!showProgress && !showRequestRejected && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Close
          </button>
        ) : null}

        {showProgress && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Hide
          </button>
        ) : null}
      </div>
    </div>
  )
}
