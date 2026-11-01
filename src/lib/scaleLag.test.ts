import { describe, expect, it } from 'vitest'
import { scaleLagErrorLabel } from './scaleLag'

describe('scaleLagErrorLabel', () => {
  it('returns null for missing or zero', () => {
    expect(scaleLagErrorLabel(undefined)).toBeNull()
    expect(scaleLagErrorLabel(0)).toBeNull()
  })

  it('formats a positive count', () => {
    expect(scaleLagErrorLabel(3)).toBe('3 errors while replicas catch up')
  })
})
