export const CANVAS_CHROME_STORAGE_KEY = 'runcloud9.canvasChromeExpanded'

export function parseCanvasChromeExpanded(
  raw: string | null | undefined,
): boolean {
  return raw === '1'
}

export function readCanvasChromeExpanded(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): boolean {
  try {
    return parseCanvasChromeExpanded(storage?.getItem(CANVAS_CHROME_STORAGE_KEY))
  } catch {
    return false
  }
}

export function writeCanvasChromeExpanded(
  expanded: boolean,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(CANVAS_CHROME_STORAGE_KEY, expanded ? '1' : '0')
  } catch {
    /* private mode / quota */
  }
}
