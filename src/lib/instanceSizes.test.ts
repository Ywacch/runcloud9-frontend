import { describe, expect, it } from 'vitest'
import {
  normalizeInstanceSize,
  normalizeInstanceSizes,
  sizesUniform,
} from './instanceSizes'

describe('normalizeInstanceSize', () => {
  it('maps alpha and unknown to small', () => {
    expect(normalizeInstanceSize('alpha')).toBe('small')
    expect(normalizeInstanceSize('huge')).toBe('small')
  })

  it('keeps medium and large', () => {
    expect(normalizeInstanceSize('medium')).toBe('medium')
    expect(normalizeInstanceSize('large')).toBe('large')
  })
})

describe('normalizeInstanceSizes', () => {
  it('pads from instanceSize', () => {
    expect(
      normalizeInstanceSizes({ instanceSize: 'large' }, 2),
    ).toEqual(['large', 'large'])
  })

  it('reads instanceSizes array', () => {
    expect(
      normalizeInstanceSizes(
        { instanceSize: 'small', instanceSizes: ['large', 'medium'] },
        2,
      ),
    ).toEqual(['large', 'medium'])
  })
})

describe('sizesUniform', () => {
  it('detects mixed sizes', () => {
    expect(sizesUniform(['large', 'small'])).toBe(false)
    expect(sizesUniform(['small', 'small'])).toBe(true)
  })
})
