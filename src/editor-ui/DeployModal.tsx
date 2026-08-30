import { DeployProgressSteps, type DeployStep } from './DeployProgressSteps'
import { SignInForm } from './SignInForm'
import { ResourceBudgetBreakdown } from './ResourceBudgetBreakdown'
import type { ResourceBudgetErrorResponse } from '../lib/sumDesignBudget'
import type { TopologyWarning } from '../lib/connectionSemantics'

export type { DeployStep }

export type DeployModalMode =
  | 'progress'
  | 'auth_required'
  | 'request_rejected'
  | 'simulation_recommended'
  | 'invalid_topology'
  | 'decorative_confirm'
  | 'deploy_warnings'

interface Props {
  open: boolean
  steps: DeployStep[]
  mode?: DeployModalMode
  requestTitle?: string | null
  requestMessage?: string | null
  technicalDetails?: string | null
  requestActionLabel?: string | null
  onRequestAction?: () => void
  requestSecondaryActionLabel?: string | null
  onRequestSecondaryAction?: () => void
  resourceBudget?: ResourceBudgetErrorResponse | null
  /** Backend returned simulation_recommended — no deployment was created. */
  simulationRecommended?: string | null
  invalidTopologyItems?: Array<{ edgeId: string; message: string }>
  decorativeConfirmMessage?: string | null
  deployWarnings?: TopologyWarning[]
  onClose?: () => void
  onAuthDismiss?: () => void
  onSimulateDesign?: () => void
  onModifyDesign?: () => void
  onDeployAnyway?: () => void
  onDeployWarningsContinue?: () => void
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
  requestSecondaryActionLabel,
  onRequestSecondaryAction,
  resourceBudget,
  simulationRecommended,
  invalidTopologyItems,
  decorativeConfirmMessage,
  deployWarnings,
  onClose,
  onAuthDismiss,
  onSimulateDesign,
  onModifyDesign,
  onDeployAnyway,
  onDeployWarningsContinue,
}: Props) {
  if (!open) return null

  const showSimulation =
    mode === 'simulation_recommended' && Boolean(simulationRecommended)
  const showAuthRequired = mode === 'auth_required'
  const showRequestRejected = mode === 'request_rejected'
  const showInvalidTopology =
    mode === 'invalid_topology' && Boolean(invalidTopologyItems?.length)
  const showDecorativeConfirm =
    mode === 'decorative_confirm' && Boolean(decorativeConfirmMessage)
  const showDeployWarnings = mode === 'deploy_warnings' && Boolean(deployWarnings?.length)
  const showProgress = mode === 'progress'

  const panelClass =
    'w-full max-w-md rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md'

  const title = showSimulation
    ? 'Simulation recommended'
    : showAuthRequired
      ? 'Sign in to deploy'
      : showInvalidTopology
        ? 'Fix invalid connections'
        : showDecorativeConfirm
          ? 'Idle components'
          : showDeployWarnings
            ? 'Deploy notes'
            : showRequestRejected
              ? requestTitle || 'Deployment could not start'
              : 'Deploying infrastructure'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/75 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-modal-title"
      >
        <h2
          id="deploy-modal-title"
          className="text-lg font-semibold tracking-tight text-[var(--c9-text)]"
        >
          {title}
        </h2>

        {showAuthRequired ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--c9-muted)]">
            Your canvas design stays here. Sign in to your RunCloud9 account, then we will start
            provisioning automatically.
          </p>
        ) : null}

        {showSimulation ? (
          <div className="mb-4 mt-4 rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-3 text-sm">
            <p className="text-xs text-purple-100/90">{simulationRecommended}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSimulateDesign?.()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-violet-500 active:scale-[0.98]"
              >
                Simulate this design
              </button>
              <button
                type="button"
                onClick={() => onModifyDesign?.()}
                className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] active:scale-[0.98]"
              >
                Modify design
              </button>
            </div>
          </div>
        ) : null}

        {showInvalidTopology ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-[var(--c9-muted)]">
              These connections would fail deploy validation. Fix them on the canvas (red edges)
              or remove them before deploying.
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100/90">
              {invalidTopologyItems?.map((item) => (
                <li key={item.edgeId}>
                  {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {showDecorativeConfirm ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-[var(--c9-text)]">
              {decorativeConfirmMessage}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDeployAnyway?.()}
                className="rounded-lg bg-[var(--c9-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
              >
                Deploy anyway
              </button>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] active:scale-[0.98]"
              >
                Keep designing
              </button>
            </div>
          </div>
        ) : null}

        {showDeployWarnings ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--c9-muted)]">
              Deployment started. Note these non-blocking warnings:
            </p>
            <ul className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              {deployWarnings?.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onDeployWarningsContinue?.()}
              className="w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
            >
              Continue
            </button>
          </div>
        ) : null}

        {showProgress ? (
          <div className="mt-4">
            <DeployProgressSteps steps={steps} />
          </div>
        ) : null}

        {showAuthRequired ? (
          <div className="mt-5">
            <SignInForm
              idPrefix="deploy-auth"
              submitLabel="Sign in and deploy"
              showForgotPasswordLink
              showHelper={false}
              onCancel={onAuthDismiss}
              cancelLabel="Keep designing"
            />
          </div>
        ) : null}

        {showRequestRejected ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-[var(--c9-text)]">
              {requestMessage || 'Please try again.'}
            </p>
            {resourceBudget ? (
              <ResourceBudgetBreakdown budget={resourceBudget} />
            ) : null}
            {technicalDetails && !resourceBudget ? (
              <p className="font-mono text-[10px] leading-relaxed text-[var(--c9-muted)]">
                {technicalDetails}
              </p>
            ) : null}
          </div>
        ) : null}

        {showRequestRejected && requestActionLabel && onRequestAction ? (
          <button
            type="button"
            onClick={onRequestAction}
            className="mt-4 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-[transform,background-color] duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
          >
            {requestActionLabel}
          </button>
        ) : null}

        {showRequestRejected &&
        requestSecondaryActionLabel &&
        onRequestSecondaryAction ? (
          <button
            type="button"
            onClick={onRequestSecondaryAction}
            className="mt-2 w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-badge-bg)] active:scale-[0.98]"
          >
            {requestSecondaryActionLabel}
          </button>
        ) : null}

        {showRequestRejected && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm text-[var(--c9-text)] transition-[transform,background-color] duration-200 hover:bg-[var(--c9-badge-bg)] active:scale-[0.98]"
          >
            Dismiss
          </button>
        ) : null}

        {showInvalidTopology && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
          >
            Back to canvas
          </button>
        ) : null}

        {!showProgress &&
        !showRequestRejected &&
        !showAuthRequired &&
        !showInvalidTopology &&
        !showDecorativeConfirm &&
        !showDeployWarnings &&
        onClose ? (
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
