import { describe, expect, it } from 'vitest'
import { keysListPath } from './introspectKeysQuery'

describe('keysListPath', () => {
  it('omits pattern so the API applies the template whitelist', () => {
    expect(keysListPath(undefined, undefined, 50)).toBe('keys?count=50')
    expect(keysListPath('', 0, 50)).toBe('keys?cursor=0&count=50')
    expect(keysListPath('  ', 0, 50)).not.toContain('pattern')
  })

  it('sends an explicit whitelist pattern', () => {
    expect(keysListPath('product:*', 0, 50)).toBe('keys?pattern=product%3A*&cursor=0&count=50')
    expect(keysListPath('*', 0, 50)).toContain('pattern=')
  })
})
