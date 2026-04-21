import { describe, expect, it } from 'vitest'
import { fmtMs } from './format'

describe('fmtMs', () => {
  it('shows em dash for zero and invalid values', () => {
    expect(fmtMs(0)).toBe('—')
    expect(fmtMs(undefined)).toBe('—')
  })

  it('shows sub-millisecond values accurately', () => {
    expect(fmtMs(0.001)).toBe('<0.1ms')
    expect(fmtMs(0.35)).toBe('0.3ms')
  })

  it('shows rounded milliseconds for values >= 1ms', () => {
    expect(fmtMs(1.2)).toBe('1ms')
    expect(fmtMs(12.7)).toBe('13ms')
  })
})
