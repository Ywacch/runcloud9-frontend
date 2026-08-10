import { templatePresetToCanvasSnapshot } from './templatePresetAdapter'
import {
  selectTemplatePreset,
  templateHasExplorerRunnable,
  type TemplatePresetMode,
} from './templatePresetMode'
import { FREE_TIER_DESIGN_LABEL } from './billingCopy'
import { hasPaidTier, type UserRecord } from './userTier'
import type { TemplateInfo } from './api'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'

/**
 * Replace canvas with the template preset for the given Explorer mode.
 * Returns false if switch is unavailable or user cancels dirty confirm.
 */
export function switchTemplatePresetMode(
  mode: TemplatePresetMode,
  opts?: { confirmIfDirty?: boolean; user?: UserRecord | null },
): boolean {
  const st = useCanvasStore.getState()
  const templateId = st.snapshotTemplateId
  if (!templateId) return false

  const user = opts?.user ?? null
  if (hasPaidTier(user)) return false

  const template = useTemplateRegistryStore.getState().byId[templateId] as
    | TemplateInfo
    | undefined
  if (!template?.preset) return false
  if (mode === 'explorer' && !templateHasExplorerRunnable(template)) return false

  if (opts?.confirmIfDirty !== false && Object.keys(st.nodes).length > 0) {
    const label =
      mode === 'explorer' ? FREE_TIER_DESIGN_LABEL : 'full architecture preview'
    if (
      !window.confirm(
        `Replace the canvas with the ${label} preset? Unsaved layout changes will be lost.`,
      )
    ) {
      return false
    }
  }

  const preset = selectTemplatePreset(template, user, mode)
  if (!preset) return false

  useSimulationStore.getState().stop()
  st.loadTemplateSnapshot(
    templatePresetToCanvasSnapshot(preset, templateId),
    'design',
  )
  st.setTemplatePresetMode(mode)
  return true
}
