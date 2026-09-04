import { describe, expect, it } from 'vitest'
import { isLoginPasswordMode } from './loginPasswordMode'

describe('loginPasswordMode', () => {
  it('enables password form only for password=1', () => {
    expect(isLoginPasswordMode('1')).toBe(true)
    expect(isLoginPasswordMode(null)).toBe(false)
    expect(isLoginPasswordMode(undefined)).toBe(false)
    expect(isLoginPasswordMode('true')).toBe(false)
    expect(isLoginPasswordMode('')).toBe(false)
  })
})
