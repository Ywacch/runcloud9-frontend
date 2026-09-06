import { describe, expect, it } from 'vitest'
import type { KeyScanResult } from './introspectApi'

describe('KeyScanResult', () => {
  it('accepts optional keyCount from introspect keys response', () => {
    const payload: KeyScanResult = {
      keys: [{ key: 'user:1', type: 'string', ttl: -1, memory: 64 }],
      cursor: 0,
      keyCount: 42,
    }
    expect(payload.keyCount).toBe(42)
  })
})
