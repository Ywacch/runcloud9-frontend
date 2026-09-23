import { afterEach, describe, expect, it } from 'vitest'
import {
  getDevInspectorMode,
  parseDevInspectorMode,
  readDevInspectorMode,
  resetDevInspectorModeCache,
  setDevInspectorMode,
  toggleDevInspectorMode,
  writeDevInspectorMode,
} from './devInspectorMode'

const memory = new Map<string, string>()

const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
}

afterEach(() => {
  memory.clear()
  resetDevInspectorModeCache()
})

describe('devInspectorMode', () => {
  it('parses stored values', () => {
    expect(parseDevInspectorMode('config')).toBe('config')
    expect(parseDevInspectorMode('live')).toBe('live')
    expect(parseDevInspectorMode(null)).toBe('live')
  })

  it('persists mode in storage', () => {
    writeDevInspectorMode('config', storage as Storage)
    expect(readDevInspectorMode(storage as Storage)).toBe('config')
  })

  it('toggles between config and live in DEV', () => {
    if (!import.meta.env.DEV) return
    setDevInspectorMode('live')
    toggleDevInspectorMode()
    expect(getDevInspectorMode()).toBe('config')
    toggleDevInspectorMode()
    expect(getDevInspectorMode()).toBe('live')
  })
})
