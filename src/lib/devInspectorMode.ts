import { useEffect, useState } from 'react'

export const DEV_INSPECTOR_MODE_KEY = 'runcloud9.devInspectorMode'

export type DevInspectorMode = 'config' | 'live'

const MODES: readonly DevInspectorMode[] = ['config', 'live']

export function parseDevInspectorMode(
  raw: string | null | undefined,
): DevInspectorMode {
  return raw === 'live' ? 'live' : 'config'
}

export function readDevInspectorMode(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): DevInspectorMode {
  try {
    return parseDevInspectorMode(storage?.getItem(DEV_INSPECTOR_MODE_KEY))
  } catch {
    return 'live'
  }
}

export function writeDevInspectorMode(
  mode: DevInspectorMode,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(DEV_INSPECTOR_MODE_KEY, mode)
  } catch {
    /* private mode / quota */
  }
}

let cached: DevInspectorMode | null = null
const listeners = new Set<(mode: DevInspectorMode) => void>()

function isDev(): boolean {
  return import.meta.env.DEV
}

export function getDevInspectorMode(): DevInspectorMode {
  if (!isDev()) return 'config'
  if (cached === null) cached = readDevInspectorMode()
  return cached
}

export function setDevInspectorMode(next: DevInspectorMode): void {
  if (!isDev()) return
  cached = next
  writeDevInspectorMode(next)
  listeners.forEach((listener) => listener(next))
}

export function toggleDevInspectorMode(): DevInspectorMode {
  const next = getDevInspectorMode() === 'live' ? 'config' : 'live'
  setDevInspectorMode(next)
  return next
}

export function subscribeDevInspectorMode(
  listener: (mode: DevInspectorMode) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDevInspectorMode(): DevInspectorMode {
  const [mode, setMode] = useState(getDevInspectorMode)
  useEffect(() => subscribeDevInspectorMode(setMode), [])
  return isDev() ? mode : 'config'
}

/** DEV design canvas: live inspector chrome + fixture metrics. */
export function devInspectorLivePreviewEnabled(): boolean {
  return isDev() && getDevInspectorMode() === 'live'
}

/** @internal test helper */
export function resetDevInspectorModeCache(): void {
  cached = null
}

export function nextDevInspectorMode(mode: DevInspectorMode): DevInspectorMode {
  const i = MODES.indexOf(mode)
  return MODES[(i + 1) % MODES.length]
}
