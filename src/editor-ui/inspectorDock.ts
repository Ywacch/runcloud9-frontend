/**
 * Docked inspector width. Matches the sidebar mock:
 * drag between 360px and min(640px, the width that leaves the canvas at least 760px).
 * Double-click and the header button snap narrow (420) / wide (640, same cap).
 */

export const INSPECTOR_DOCK = {
  min: 360,
  narrow: 420,
  wide: 640,
  canvasMin: 760,
  /** Two-column layout starts here. Below this the panel stays one column. */
  layoutBreak: 600,
  storageKey: 'rc-dir-sidebar-w',
  nudge: 24,
} as const

export function inspectorMaxWidth(windowWidth: number): number {
  const room = windowWidth - INSPECTOR_DOCK.canvasMin
  const cap = Math.min(INSPECTOR_DOCK.wide, room)
  return Math.max(INSPECTOR_DOCK.min, Math.round(cap))
}

export function clampInspectorWidth(px: number, windowWidth: number): number {
  if (!Number.isFinite(px)) return clampInspectorWidth(INSPECTOR_DOCK.narrow, windowWidth)
  return Math.max(
    INSPECTOR_DOCK.min,
    Math.min(inspectorMaxWidth(windowWidth), Math.round(px)),
  )
}

export function inspectorWideTarget(windowWidth: number): number {
  return Math.min(INSPECTOR_DOCK.wide, inspectorMaxWidth(windowWidth))
}

/** Wide once the panel is at least halfway from narrow to the wide snap. */
export function inspectorIsWide(width: number, windowWidth: number): boolean {
  const wide = inspectorWideTarget(windowWidth)
  return width >= (INSPECTOR_DOCK.narrow + wide) / 2
}

export function inspectorLayout(width: number): 'narrow' | 'wide' {
  return width >= INSPECTOR_DOCK.layoutBreak ? 'wide' : 'narrow'
}

export function toggleInspectorWidth(width: number, windowWidth: number): number {
  return inspectorIsWide(width, windowWidth)
    ? clampInspectorWidth(INSPECTOR_DOCK.narrow, windowWidth)
    : inspectorWideTarget(windowWidth)
}

export function readInspectorWidthPref(
  storage: Pick<Storage, 'getItem'> | null,
): number {
  try {
    const raw = storage?.getItem(INSPECTOR_DOCK.storageKey)
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    /* private mode */
  }
  return INSPECTOR_DOCK.narrow
}

export function writeInspectorWidthPref(
  storage: Pick<Storage, 'setItem'> | null,
  width: number,
): void {
  try {
    storage?.setItem(INSPECTOR_DOCK.storageKey, String(Math.round(width)))
  } catch {
    /* private mode / quota */
  }
}
