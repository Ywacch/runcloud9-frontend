import type { FloorThemeId } from '../theme/floorTheme'

export const FLOOR_THEME_STORAGE_KEY = 'c9-canvas-floor-theme'

const VALID: readonly FloorThemeId[] = ['dark', 'light']

export function parseFloorTheme(
  raw: string | null | undefined,
): FloorThemeId {
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as FloorThemeId
  }
  return 'dark'
}

export function readStoredFloorTheme(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): FloorThemeId {
  try {
    return parseFloorTheme(storage?.getItem(FLOOR_THEME_STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

export function writeStoredFloorTheme(
  theme: FloorThemeId,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(FLOOR_THEME_STORAGE_KEY, theme)
  } catch {
    // private mode / quota — ignore
  }
}
