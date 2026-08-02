/**
 * Re-export preset selection from templatePresetMode (canonical policy).
 * Prefer importing from `./templatePresetMode` for new call sites.
 */
export {
  selectTemplatePreset,
  type TemplatePresetMode,
} from './templatePresetMode'
