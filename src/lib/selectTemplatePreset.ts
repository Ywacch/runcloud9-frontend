import type { TemplateInfo, TemplatePreset } from './api'
import { hasPaidTier, type UserRecord } from './userTier'

/** Pick engineer preset or explorer lite variant — mirrors backend template loading. */
export function selectTemplatePreset(
  template: Pick<TemplateInfo, 'id' | 'preset' | 'presetLite'>,
  user: UserRecord | null,
): TemplatePreset | undefined {
  if (!template.preset) return undefined
  if (hasPaidTier(user)) return template.preset
  return template.presetLite ?? template.preset
}
