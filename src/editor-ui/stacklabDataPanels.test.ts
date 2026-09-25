import { describe, expect, it } from 'vitest'
import { fmtTtlHuman } from './stacklabDataPanels'

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
