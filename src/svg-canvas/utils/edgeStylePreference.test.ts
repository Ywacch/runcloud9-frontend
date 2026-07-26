import { describe, expect, it } from 'vitest'
import {
  EDGE_STYLE_STORAGE_KEY,
  parseEdgeStylePreset,
  readStoredEdgeStylePreset,
  writeStoredEdgeStylePreset,
} from './edgeStylePreference'

describe('edgeStylePreference', () => {
  it('defaults to flow', () => {
    expect(parseEdgeStylePreset(null)).toBe('flow')
    expect(parseEdgeStylePreset('nope')).toBe('flow')
  })

  it('round-trips through storage', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
    }
    writeStoredEdgeStylePreset('schematic', storage)
    expect(mem.get(EDGE_STYLE_STORAGE_KEY)).toBe('schematic')
    expect(readStoredEdgeStylePreset(storage)).toBe('schematic')
  })
})
