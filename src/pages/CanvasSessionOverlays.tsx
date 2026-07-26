import type { ReactNode } from 'react'
import {
  CascadeToast,
  ChaosOverlayTicker,
  EventTimeline,
  LiveOverlay,
  ProvisioningOverlay,
  RejoinBanner,
  SimulationOverlay,
  SystemTopBar,
} from '../editor-ui'
import type { CanvasSessionLifecycle } from './useCanvasSessionLifecycle'

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
        <div className="pointer-events-none absolute left-3 top-0 z-30 flex w-fit max-w-[50%] min-w-0 flex-col gap-2 pr-3 pt-3">
          <SystemTopBar />
          <EventTimeline />
          <div className="pointer-events-auto flex w-full min-w-0 flex-col gap-2">
            <LiveOverlay />
            <SimulationOverlay />
          </div>
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
            <h3 className="text-lg font-semibold text-red-300">Provisioning Failed</h3>
            <p className="mt-2 text-sm text-[var(--c9-muted)]">{provisioningError}</p>
            <button
              type="button"
              className="mt-4 w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-4 py-2 text-sm transition-colors duration-200 hover:border-[var(--c9-accent)]"
              onClick={dismissProvisioningError}
            >
              Back to design
            </button>
          </div>
        </div>
      ) : null}
      {mode === 'live' ? (
        <>
          <ChaosOverlayTicker />
          <CascadeToast />
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
