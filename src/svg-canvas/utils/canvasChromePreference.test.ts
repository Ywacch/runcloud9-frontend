import { describe, expect, it } from 'vitest'
import {
  parseCanvasChromeExpanded,
  readCanvasChromeExpanded,
  writeCanvasChromeExpanded,
} from './canvasChromePreference'

describe('canvasChromePreference', () => {
  it('defaults collapsed', () => {
    expect(parseCanvasChromeExpanded(null)).toBe(false)
    expect(readCanvasChromeExpanded({ getItem: () => null })).toBe(false)
  })

  it('round-trips expanded flag', () => {
    const store: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    }
    writeCanvasChromeExpanded(true, storage)
    expect(readCanvasChromeExpanded(storage)).toBe(true)
    writeCanvasChromeExpanded(false, storage)
    expect(readCanvasChromeExpanded(storage)).toBe(false)
  })
})
