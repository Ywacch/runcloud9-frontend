import { describe, expect, it } from 'vitest'
import { fmtTtlHuman, formatRowCount } from './stacklabDataPanels'

describe('formatRowCount', () => {
  it('formats the full integer with grouping', () => {
    expect(formatRowCount(1_000_123)).toBe('1,000,123')
    expect(formatRowCount(1_025_000)).toBe('1,025,000')
    expect(formatRowCount(235_400)).toBe('235,400')
  })
})

describe('fmtTtlHuman', () => {
  it('formats sub-second TTL in milliseconds', () => {
    expect(fmtTtlHuman(0.45)).toBe('450ms(TTL)')
  })

  it('formats second-scale TTL without minutes', () => {
    expect(fmtTtlHuman(120)).toBe('120s(TTL)')
  })

  it('shows none for negative TTL', () => {
    expect(fmtTtlHuman(-1)).toBe('TTL —')
    expect(fmtTtlHuman(-1, true)).toBe('TTL none')
  })
})
