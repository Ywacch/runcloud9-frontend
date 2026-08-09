import { describe, expect, it } from 'vitest'
import {
  DEV_CANVAS_CHROME_KEY,
  DEV_CANVAS_TOOLS_KEY,
  debugExtrasVisibleForMode,
  liveStripVisibleForMode,
  nextDevCanvasChromeMode,
  parseDevCanvasChromeMode,
  readDevCanvasChromeMode,
  viewToolsVisibleForMode,
  writeDevCanvasChromeMode,
} from './devCanvasTools'

describe('devCanvasTools', () => {
  it('defaults to hud', () => {
    expect(parseDevCanvasChromeMode(null)).toBe('hud')
    expect(readDevCanvasChromeMode({ getItem: () => null })).toBe('hud')
  })

  it('cycles hud → debug → clean → hud', () => {
    expect(nextDevCanvasChromeMode('hud')).toBe('debug')
    expect(nextDevCanvasChromeMode('debug')).toBe('clean')
    expect(nextDevCanvasChromeMode('clean')).toBe('hud')
  })

  it('shows the live strip except in clean dev', () => {
    expect(liveStripVisibleForMode('hud', true)).toBe(true)
    expect(liveStripVisibleForMode('debug', true)).toBe(true)
    expect(liveStripVisibleForMode('clean', true)).toBe(false)
    expect(liveStripVisibleForMode('clean', false)).toBe(true)
  })

  it('shows view tools in prod and hud; hides in clean or when pref is off', () => {
    expect(viewToolsVisibleForMode('hud', true)).toBe(true)
    expect(viewToolsVisibleForMode('debug', true)).toBe(true)
    expect(viewToolsVisibleForMode('clean', true)).toBe(false)
    expect(viewToolsVisibleForMode('hud', false)).toBe(true)
    expect(viewToolsVisibleForMode('debug', false)).toBe(true)
    expect(viewToolsVisibleForMode('hud', true, false)).toBe(false)
    expect(debugExtrasVisibleForMode('debug', true)).toBe(true)
    expect(debugExtrasVisibleForMode('hud', true)).toBe(false)
    expect(debugExtrasVisibleForMode('debug', false)).toBe(false)
  })

  it('round-trips chrome mode', () => {
    const store: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    }
    writeDevCanvasChromeMode('clean', storage)
    expect(readDevCanvasChromeMode(storage)).toBe('clean')
    writeDevCanvasChromeMode('debug', storage)
    expect(readDevCanvasChromeMode(storage)).toBe('debug')
  })

  it('migrates the old tools flag to debug', () => {
    expect(
      readDevCanvasChromeMode({
        getItem: (k: string) => (k === DEV_CANVAS_TOOLS_KEY ? '1' : null),
      }),
    ).toBe('debug')
    expect(
      readDevCanvasChromeMode({
        getItem: (k: string) =>
          k === DEV_CANVAS_CHROME_KEY ? 'hud' : k === DEV_CANVAS_TOOLS_KEY ? '1' : null,
      }),
    ).toBe('hud')
  })
})
