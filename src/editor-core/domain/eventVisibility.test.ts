import { describe, expect, it } from 'vitest'
import { parseEventVisibility } from './eventVisibility'

describe('parseEventVisibility', () => {
  it('accepts current values', () => {
    expect(parseEventVisibility('all')).toBe('all')
    expect(parseEventVisibility('student')).toBe('student')
    expect(parseEventVisibility('operator')).toBe('operator')
  })

  it('normalizes legacy audience aliases', () => {
    expect(parseEventVisibility(undefined, 'both')).toBe('all')
    expect(parseEventVisibility(undefined, 'user')).toBe('student')
    expect(parseEventVisibility(undefined, 'ai')).toBeUndefined()
  })
})
