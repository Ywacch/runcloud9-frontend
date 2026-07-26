import type { GridMode } from '../components/Floor'

export const GRID_MODE_STORAGE_KEY = 'c9-canvas-grid-mode'

const VALID: readonly GridMode[] = ['infinite', 'bounded', 'off']

export function parseGridMode(raw: string | null | undefined): GridMode {
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as GridMode
  }
  return 'infinite'
}

export function readStoredGridMode(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): GridMode {
  try {
    return parseGridMode(storage?.getItem(GRID_MODE_STORAGE_KEY))
  } catch {
    return 'infinite'
  }
}

export function writeStoredGridMode(
  mode: GridMode,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(GRID_MODE_STORAGE_KEY, mode)
  } catch {
    // private mode / quota — ignore
  }
}
