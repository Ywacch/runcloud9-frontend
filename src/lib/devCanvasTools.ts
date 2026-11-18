import { useEffect, useState } from 'react'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'

export const DEV_CANVAS_CHROME_KEY = 'runcloud9.devCanvasChrome'
/** @deprecated Migrated into DEV_CANVAS_CHROME_KEY. */
export const DEV_CANVAS_TOOLS_KEY = 'runcloud9.devCanvasTools'
/** Product Fit / grid / floor chrome. Default on. */
export const CANVAS_VIEW_TOOLS_KEY = 'runcloud9.canvasViewTools'

export type DevCanvasChromeMode = 'hud' | 'debug' | 'clean'

const MODES: readonly DevCanvasChromeMode[] = ['hud', 'debug', 'clean']

export function parseDevCanvasChromeMode(
  raw: string | null | undefined,
): DevCanvasChromeMode {
  if (raw === 'debug' || raw === 'clean' || raw === 'hud') return raw
  return isDev() ? 'clean' : 'hud'
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
  prefVisible = true,
): boolean {
  if (dev && mode === 'clean') return false
  return prefVisible
}

/** Pixi fallback / FX demo: DEV debug only. */
export function debugExtrasVisibleForMode(
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
let viewToolsPref: boolean | null = null
const viewToolsListeners = new Set<(visible: boolean) => void>()

export function readCanvasViewToolsVisible(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): boolean {
  try {
    return storage?.getItem(CANVAS_VIEW_TOOLS_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeCanvasViewToolsVisible(
  visible: boolean,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(CANVAS_VIEW_TOOLS_KEY, visible ? '1' : '0')
  } catch {
    /* private mode / quota */
  }
}

export function getCanvasViewToolsPref(): boolean {
  if (viewToolsPref === null) viewToolsPref = readCanvasViewToolsVisible()
  return viewToolsPref
}

export function setCanvasViewToolsPref(visible: boolean): void {
  viewToolsPref = visible
  writeCanvasViewToolsVisible(visible)
  viewToolsListeners.forEach((listener) => listener(visible))
}

export function subscribeCanvasViewToolsPref(
  listener: (visible: boolean) => void,
): () => void {
  viewToolsListeners.add(listener)
  return () => {
    viewToolsListeners.delete(listener)
  }
}

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
  return viewToolsVisibleForMode(
    getDevCanvasChromeMode(),
    isDev(),
    getCanvasViewToolsPref(),
  )
}

export function getDevLiveStripVisible(): boolean {
  return liveStripVisibleForMode(getDevCanvasChromeMode(), isDev())
}

/** Hide or show Fit / grid / floor chrome (persists in prod and DEV). */
export function setDevCanvasToolsVisible(next: boolean): void {
  setCanvasViewToolsPref(next)
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
  const emit = () => {
    listener(
      viewToolsVisibleForMode(
        getDevCanvasChromeMode(),
        isDev(),
        getCanvasViewToolsPref(),
      ),
    )
  }
  const unChrome = subscribeDevCanvasChromeMode(() => emit())
  const unPref = subscribeCanvasViewToolsPref(() => emit())
  return () => {
    unChrome()
    unPref()
  }
}

export function useDevCanvasChromeMode(): DevCanvasChromeMode {
  const [mode, setMode] = useState(getDevCanvasChromeMode)
  useEffect(() => subscribeDevCanvasChromeMode(setMode), [])
  return isDev() ? mode : 'hud'
}

/** Fit / grid / floor / zoom. On in prod; off in DEV clean or after Hide. */
export function useDevCanvasToolsVisible(): boolean {
  const mode = useDevCanvasChromeMode()
  const [pref, setPref] = useState(getCanvasViewToolsPref)
  useEffect(() => subscribeCanvasViewToolsPref(setPref), [])
  return viewToolsVisibleForMode(mode, isDev(), pref)
}

/** DEV-only extras (Pixi fallback, FX demo). */
export function useDevDebugExtrasVisible(): boolean {
  return debugExtrasVisibleForMode(useDevCanvasChromeMode(), isDev())
}

/** Live / sim topbar. Always on in production. */
export function useDevLiveStripVisible(): boolean {
  return liveStripVisibleForMode(useDevCanvasChromeMode(), isDev())
}
