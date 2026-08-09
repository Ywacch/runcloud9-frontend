import { useEffect, useState } from 'react'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'

export const DEV_CANVAS_CHROME_KEY = 'runcloud9.devCanvasChrome'
/** @deprecated Migrated into DEV_CANVAS_CHROME_KEY. */
export const DEV_CANVAS_TOOLS_KEY = 'runcloud9.devCanvasTools'

export type DevCanvasChromeMode = 'hud' | 'debug' | 'clean'

const MODES: readonly DevCanvasChromeMode[] = ['hud', 'debug', 'clean']

export function parseDevCanvasChromeMode(
  raw: string | null | undefined,
): DevCanvasChromeMode {
  if (raw === 'debug' || raw === 'clean' || raw === 'hud') return raw
  return 'hud'
}

export function nextDevCanvasChromeMode(
  mode: DevCanvasChromeMode,
): DevCanvasChromeMode {
  const i = MODES.indexOf(mode)
  return MODES[(i + 1) % MODES.length]
}

export function viewToolsVisibleForMode(
  mode: DevCanvasChromeMode,
  dev: boolean,
): boolean {
  return dev && mode === 'debug'
}

export function liveStripVisibleForMode(
  mode: DevCanvasChromeMode,
  dev: boolean,
): boolean {
  return !dev || mode !== 'clean'
}

export function readDevCanvasChromeMode(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): DevCanvasChromeMode {
  try {
    const stored = storage?.getItem(DEV_CANVAS_CHROME_KEY)
    if (stored === 'debug' || stored === 'clean' || stored === 'hud') {
      return stored
    }
    if (storage?.getItem(DEV_CANVAS_TOOLS_KEY) === '1') return 'debug'
    return 'hud'
  } catch {
    return 'hud'
  }
}

export function writeDevCanvasChromeMode(
  mode: DevCanvasChromeMode,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(DEV_CANVAS_CHROME_KEY, mode)
  } catch {
    /* private mode / quota */
  }
}

let cached: DevCanvasChromeMode | null = null
const listeners = new Set<(mode: DevCanvasChromeMode) => void>()

function isDev(): boolean {
  return import.meta.env.DEV
}

export function getDevCanvasChromeMode(): DevCanvasChromeMode {
  if (!isDev()) return 'hud'
  if (cached === null) cached = readDevCanvasChromeMode()
  return cached
}

export function setDevCanvasChromeMode(next: DevCanvasChromeMode): void {
  if (!isDev()) return
  cached = next
  writeDevCanvasChromeMode(next)
  listeners.forEach((listener) => listener(next))
  if (typeof window !== 'undefined') {
    window.setTimeout(() => requestCanvasFit(), 80)
  }
}

export function cycleDevCanvasChromeMode(): DevCanvasChromeMode {
  const next = nextDevCanvasChromeMode(getDevCanvasChromeMode())
  setDevCanvasChromeMode(next)
  return next
}

export function getDevCanvasToolsVisible(): boolean {
  return viewToolsVisibleForMode(getDevCanvasChromeMode(), isDev())
}

export function getDevLiveStripVisible(): boolean {
  return liveStripVisibleForMode(getDevCanvasChromeMode(), isDev())
}

/** Hide Fit/View tools but keep the live topbar (debug → hud). */
export function setDevCanvasToolsVisible(next: boolean): void {
  if (!isDev()) return
  if (next) {
    setDevCanvasChromeMode('debug')
    return
  }
  if (getDevCanvasChromeMode() === 'debug') setDevCanvasChromeMode('hud')
}

export function toggleDevCanvasToolsVisible(): DevCanvasChromeMode {
  return cycleDevCanvasChromeMode()
}

export function subscribeDevCanvasChromeMode(
  listener: (mode: DevCanvasChromeMode) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function subscribeDevCanvasToolsVisible(
  listener: (visible: boolean) => void,
): () => void {
  return subscribeDevCanvasChromeMode((mode) => {
    listener(viewToolsVisibleForMode(mode, isDev()))
  })
}

export function useDevCanvasChromeMode(): DevCanvasChromeMode {
  const [mode, setMode] = useState(getDevCanvasChromeMode)
  useEffect(() => subscribeDevCanvasChromeMode(setMode), [])
  return isDev() ? mode : 'hud'
}

/** Fit / grid / floor / host switch. */
export function useDevCanvasToolsVisible(): boolean {
  return viewToolsVisibleForMode(useDevCanvasChromeMode(), isDev())
}

/** Live / sim topbar. Always on in production. */
export function useDevLiveStripVisible(): boolean {
  return liveStripVisibleForMode(useDevCanvasChromeMode(), isDev())
}
