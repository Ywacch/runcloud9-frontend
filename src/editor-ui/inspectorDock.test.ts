import { describe, expect, it } from 'vitest'
import {
  clampInspectorWidth,
  inspectorIsWide,
  inspectorLayout,
  inspectorMaxWidth,
  inspectorWideTarget,
  readInspectorWidthPref,
  toggleInspectorWidth,
  writeInspectorWidthPref,
} from './inspectorDock'

describe('inspectorDock', () => {
  it('caps a 1440px window at 640 and keeps the canvas at least 760', () => {
    expect(inspectorMaxWidth(1440)).toBe(640)
    expect(1440 - inspectorMaxWidth(1440)).toBeGreaterThanOrEqual(760)
  })

  it('shrinks with the window but never below 360', () => {
    expect(inspectorMaxWidth(1200)).toBe(440)
    expect(inspectorMaxWidth(1000)).toBe(360)
    expect(clampInspectorWidth(900, 1440)).toBe(640)
    expect(clampInspectorWidth(200, 1440)).toBe(360)
  })

  it('snaps narrow and wide around the midpoint', () => {
    expect(inspectorWideTarget(1440)).toBe(640)
    expect(inspectorIsWide(420, 1440)).toBe(false)
    expect(inspectorIsWide(640, 1440)).toBe(true)
    expect(toggleInspectorWidth(420, 1440)).toBe(640)
    expect(toggleInspectorWidth(640, 1440)).toBe(420)
    expect(toggleInspectorWidth(500, 1200)).toBe(420)
  })

  it('uses one column under 600px and two columns at the wide snap', () => {
    expect(inspectorLayout(420)).toBe('narrow')
    expect(inspectorLayout(599)).toBe('narrow')
    expect(inspectorLayout(600)).toBe('wide')
    expect(inspectorLayout(640)).toBe('wide')
  })

  it('remembers a stored width and falls back to 420', () => {
    const bag = new Map<string, string>()
    const storage = {
      getItem: (k: string) => bag.get(k) ?? null,
      setItem: (k: string, v: string) => {
        bag.set(k, v)
      },
    }
    expect(readInspectorWidthPref(storage)).toBe(420)
    writeInspectorWidthPref(storage, 640)
    expect(readInspectorWidthPref(storage)).toBe(640)
    expect(readInspectorWidthPref(null)).toBe(420)
  })
})
