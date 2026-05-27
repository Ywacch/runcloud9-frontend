import { memo } from 'react'

export type DeployStep = {
  id: string
  label: string
  state: 'pending' | 'active' | 'done' | 'error'
  detail?: string
}

export const DeployProgressSteps = memo(function DeployProgressSteps({
  steps,
  className = '',
}: {
  steps: DeployStep[]
  className?: string
}) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start gap-3">
          <div className="mt-0.5">
            {step.state === 'done' ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                <span className="text-xs text-emerald-400">✓</span>
              </div>
            ) : step.state === 'active' ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--c9-accent)]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--c9-accent)]" />
              </div>
            ) : step.state === 'error' ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
                <span className="text-xs text-red-400">✕</span>
              </div>
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--c9-border)]">
                <span className="text-xs text-[var(--c9-muted)]">{i + 1}</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={`text-sm font-medium ${
                step.state === 'active'
                  ? 'text-[var(--c9-text)]'
                  : step.state === 'done'
                    ? 'text-[var(--c9-muted)]'
                    : step.state === 'error'
                      ? 'text-red-400'
                      : 'text-[var(--c9-muted)]'
              }`}
            >
              {step.label}
            </div>
            {step.detail ? (
              <div className="mt-0.5 text-xs leading-snug text-[var(--c9-muted)]">
                {step.detail}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
})
