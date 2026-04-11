export type DeployStep = {
  id: string
  label: string
  state: 'pending' | 'active' | 'done' | 'error'
  detail?: string
}

interface Props {
  open: boolean
  steps: DeployStep[]
  error?: string | null
  /** Backend returned simulation_recommended — no deployment was created. */
  simulationRecommended?: string | null
  onClose?: () => void
  onSimulateDesign?: () => void
  onModifyDesign?: () => void
}

export function DeployModal({
  open,
  steps,
  error,
  simulationRecommended,
  onClose,
  onSimulateDesign,
  onModifyDesign,
}: Props) {
  if (!open) return null

  const showSimulation = Boolean(simulationRecommended)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {showSimulation ? 'Simulation recommended' : 'Deploying Infrastructure'}
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

        {!showSimulation ? (
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

        {error ? (
          <div className="mt-4 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {error && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  )
}
