import type { ReactNode } from 'react'
import {
  AlertToastStack,
  CascadeToast,
  InvariantToast,
  ChaosOverlayTicker,
  DeploymentPlayground,
  EventTimeline,
  InspectorAlertWatcher,
  ProvisioningOverlay,
  RejoinBanner,
  SessionEndingOverlay,
  SimulationOverlay,
} from '../editor-ui'
import { PROVISION_FAILED_HEADLINE } from '../lib/provisionCopy'
import type { CanvasSessionLifecycle } from './useCanvasSessionLifecycle'
import { SHOW_SIMULATION_UI } from '../lib/featureFlags'

export type CanvasSessionOverlaysProps = {
  session: CanvasSessionLifecycle
  /** Optional slot under the rejoin banner (e.g. design journey button). */
  children?: ReactNode
}

/**
 * Live / simulate / provision overlays shared by CanvasPage and SvgCanvasPage.
 * Design-journey chrome stays in each page (or pass via children).
 */
export function CanvasSessionOverlays({
  session,
  children,
}: CanvasSessionOverlaysProps) {
  const {
    prompt,
    rejoin,
    dismiss,
    mode,
    nodes,
    provisioningElapsed,
    provisionMetricsSummary,
    isTerminating,
    isQueued,
    queuePosition,
    estimatedWaitSeconds,
    overlayMinimized,
    showProvisioningOverlay,
    showProvisioningError,
    provisioningError,
    terminationMessage,
    cancelProvisioning,
    dismissProvisioningError,
    minimizeOverlay,
    expandOverlay,
  } = session

  return (
    <>
      {/* Rejoin must show in design mode too (default when opening /canvas). */}
      {prompt ? (
        <div className="pointer-events-none absolute left-3 top-3 z-40 flex w-fit max-w-[min(100%,28rem)] min-w-0 pr-3">
          <RejoinBanner
            deploymentName={prompt.deploymentId}
            expiresAt={prompt.expiresAt}
            onRejoin={() => {
              void rejoin()
            }}
            onDismiss={dismiss}
          />
        </div>
      ) : null}
      {children}
      {mode !== 'design' ? (
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex min-w-0 max-w-[min(100%,28rem)] flex-col gap-1.5 pr-14">
          <EventTimeline />
          {SHOW_SIMULATION_UI ? (
            <div className="pointer-events-auto w-fit max-w-full">
              <SimulationOverlay />
            </div>
          ) : null}
        </div>
      ) : null}
      {showProvisioningOverlay ? (
        <ProvisioningOverlay
          elapsedSeconds={provisioningElapsed}
          metricsSummary={provisionMetricsSummary}
          nodes={nodes}
          isTerminating={isTerminating}
          isQueued={isQueued}
          queuePosition={queuePosition}
          estimatedWaitSeconds={estimatedWaitSeconds}
          minimized={overlayMinimized}
          onMinimize={minimizeOverlay}
          onExpand={expandOverlay}
          onCancel={cancelProvisioning}
        />
      ) : null}
      {showProvisioningError ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--c9-bg)]/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-red-800 bg-[var(--c9-surface)]/95 p-5 text-[var(--c9-text)] shadow-xl">
            <h3 className="text-lg font-semibold text-red-300">{PROVISION_FAILED_HEADLINE}</h3>
            <p className="mt-2 text-sm text-[var(--c9-muted)]">{provisioningError}</p>
            <button
              type="button"
              className="mt-4 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm transition-colors duration-200 hover:border-[var(--c9-accent)]"
              onClick={dismissProvisioningError}
            >
              Back to canvas
            </button>
          </div>
        </div>
      ) : null}
      <SessionEndingOverlay />
      {mode === 'live' ? (
        <>
          <DeploymentPlayground />
          <ChaosOverlayTicker />
          <CascadeToast />
          <InvariantToast />
          <InspectorAlertWatcher />
          <AlertToastStack />
        </>
      ) : null}
      {terminationMessage ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-3 py-2 text-xs text-[var(--c9-text)] shadow-lg">
          {terminationMessage}
        </div>
      ) : null}
    </>
  )
}
