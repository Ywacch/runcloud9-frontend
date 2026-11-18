import type { CanvasMode } from '../editor-core/stores/canvasStore'

/** Design canvas before deploy: match runcloud9-ui picker + placed + cv-pop (not dev/live chrome). */
export function isRuncloud9DesignFlow(
  mode: CanvasMode,
  deploymentId: string | null,
): boolean {
  return mode === 'design' && !deploymentId
}

export function runcloud9PickerPhase(
  mode: CanvasMode,
  deploymentId: string | null,
  nodeCount: number,
  snapshotTemplateId: string | null,
): boolean {
  return isRuncloud9DesignFlow(mode, deploymentId) && !(nodeCount > 0 && snapshotTemplateId)
}

export function runcloud9PlacedDesignPhase(
  mode: CanvasMode,
  deploymentId: string | null,
  nodeCount: number,
  snapshotTemplateId: string | null,
): boolean {
  return isRuncloud9DesignFlow(mode, deploymentId) && nodeCount > 0 && Boolean(snapshotTemplateId)
}