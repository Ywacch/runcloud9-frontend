import type { ReactNode } from 'react'
import {
  AlertToastStack,
  CascadeToast,
  InvariantToast,
  ChaosOverlayTicker,
  DeploymentPlayground,
  EventTimeline,
  InspectorAlertWatcher,
  DevProvisionPreviewController,
  ProvisionStrip,
  RejoinBanner,
  SessionEndingOverlay,
  SimulationOverlay,
} from '../editor-ui'
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
    showProvisioningOverlay,
    showProvisioningError,
    terminationMessage,
    cancelProvisioning,
    dismissProvisioningError,
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
      <DevProvisionPreviewController
        blocked={showProvisioningOverlay || showProvisioningError}
      />
      <ProvisionStrip
        onCancel={cancelProvisioning}
        onDismissError={dismissProvisioningError}
      />
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
