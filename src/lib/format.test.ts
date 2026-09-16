import { describe, expect, it } from 'vitest'
import { clampPercent, FMT_EMPTY, fmtMs, utilizationPercent } from './format'

describe('fmtMs', () => {
  it('shows empty placeholder for zero and invalid values', () => {
    expect(fmtMs(0)).toBe(FMT_EMPTY)
    expect(fmtMs(undefined)).toBe(FMT_EMPTY)
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

describe('clampPercent', () => {
  it('keeps sub-1% utilization instead of rounding to 0', () => {
    expect(clampPercent(0.4)).toBe(0.4)
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(8)).toBe(8)
  })
})

describe('utilizationPercent', () => {
  it('does not round idle postgres millicores against a 2-cpu limit to 0', () => {
    expect(utilizationPercent(0.015, 2)).toBe(0.8)
  })
})

