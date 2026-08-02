import { isEngineerOnlyNodeType } from './canvasContextMenuCatalog'
import type { TemplatePresetMode } from './templatePresetMode'

/**
 * Opacity for Engineer-only nodes on Explorer full-architecture preview.
 * Does not use create-menu DEV lock bypass — preview mute should work in local DEV.
 */
export function engineerLockedNodeOpacity(opts: {
  nodeType: string
  isFreeUser: boolean
  mode: TemplatePresetMode | null | undefined
}): number {
  if (!opts.isFreeUser) return 1
  if (opts.mode !== 'full') return 1
  if (!isEngineerOnlyNodeType(opts.nodeType as never)) return 1
  return 0.38
}

/** True when an Engineer-only node is preview-muted for Explorer full mode. */
export function isEngineerPreviewLocked(opts: {
  nodeType: string
  isFreeUser: boolean
  mode: TemplatePresetMode | null | undefined
}): boolean {
  return engineerLockedNodeOpacity(opts) < 1
}
