import { describe, expect, it } from 'vitest'
import {
  FLOOR_THEME_STORAGE_KEY,
  parseFloorTheme,
  readStoredFloorTheme,
  writeStoredFloorTheme,
} from './floorThemePreference'

describe('floorThemePreference', () => {
  it('parseFloorTheme accepts dark and light', () => {
    expect(parseFloorTheme('dark')).toBe('dark')
    expect(parseFloorTheme('light')).toBe('light')
  })

  it('parseFloorTheme defaults unknown values to dark', () => {
    expect(parseFloorTheme(null)).toBe('dark')
    expect(parseFloorTheme(undefined)).toBe('dark')
    expect(parseFloorTheme('')).toBe('dark')
    expect(parseFloorTheme('system')).toBe('dark')
  })

  it('read/write round-trips through storage', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }
    writeStoredFloorTheme('light', storage)
    expect(store.get(FLOOR_THEME_STORAGE_KEY)).toBe('light')
    expect(readStoredFloorTheme(storage)).toBe('light')
    writeStoredFloorTheme('dark', storage)
    expect(readStoredFloorTheme(storage)).toBe('dark')
  })
})
