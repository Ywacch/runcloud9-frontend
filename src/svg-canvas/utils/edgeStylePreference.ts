import type { EdgeStylePresetId } from '../fx/edgePresets'

export const EDGE_STYLE_STORAGE_KEY = 'c9-canvas-edge-style'

const VALID: readonly EdgeStylePresetId[] = ['flow', 'schematic']

export function parseEdgeStylePreset(
  raw: string | null | undefined,
): EdgeStylePresetId {
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as EdgeStylePresetId
  }
  return 'flow'
}

export function readStoredEdgeStylePreset(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): EdgeStylePresetId {
  try {
    return parseEdgeStylePreset(storage?.getItem(EDGE_STYLE_STORAGE_KEY))
  } catch {
    return 'flow'
  }
}

export function writeStoredEdgeStylePreset(
  preset: EdgeStylePresetId,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(EDGE_STYLE_STORAGE_KEY, preset)
  } catch {
    // private mode / quota — ignore
  }
}
