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
  void opts
  return 1
}

/** True when an Engineer-only node is preview-muted for Explorer full mode. */
export function isEngineerPreviewLocked(opts: {
  nodeType: string
  isFreeUser: boolean
  mode: TemplatePresetMode | null | undefined
}): boolean {
  void opts
  return false
}
