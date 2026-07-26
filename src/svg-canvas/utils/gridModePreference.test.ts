import { describe, expect, it } from 'vitest'
import {
  GRID_MODE_STORAGE_KEY,
  parseGridMode,
  readStoredGridMode,
  writeStoredGridMode,
} from './gridModePreference'

describe('gridModePreference', () => {
  it('parseGridMode accepts infinite, bounded, off', () => {
    expect(parseGridMode('infinite')).toBe('infinite')
    expect(parseGridMode('bounded')).toBe('bounded')
    expect(parseGridMode('off')).toBe('off')
  })

  it('parseGridMode defaults unknown values to infinite', () => {
    expect(parseGridMode(null)).toBe('infinite')
    expect(parseGridMode(undefined)).toBe('infinite')
    expect(parseGridMode('')).toBe('infinite')
    expect(parseGridMode('grid')).toBe('infinite')
  })

  it('read/write round-trips through storage', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }
    writeStoredGridMode('bounded', storage)
    expect(store.get(GRID_MODE_STORAGE_KEY)).toBe('bounded')
    expect(readStoredGridMode(storage)).toBe('bounded')
    writeStoredGridMode('off', storage)
    expect(readStoredGridMode(storage)).toBe('off')
  })
})
