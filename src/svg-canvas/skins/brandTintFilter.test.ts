import { describe, expect, it } from 'vitest'
import {
  isNearGreyscale,
  parseHexRgb,
  tintColorMatrixValues,
} from './brandTintFilter'

describe('parseHexRgb', () => {
  it('parses #rrggbb', () => {
    expect(parseHexRgb('#d82f27')).toEqual({
      r: 216 / 255,
      g: 47 / 255,
      b: 39 / 255,
    })
  })

  it('parses #rgb', () => {
    expect(parseHexRgb('#f00')).toEqual({ r: 1, g: 0, b: 0 })
  })

  it('rejects garbage', () => {
    expect(parseHexRgb('nope')).toBeNull()
  })
})

describe('isNearGreyscale', () => {
  it('accepts neutral greys', () => {
    expect(
      isNearGreyscale({
        top: '#e8e8ea',
        left: '#d2d2d4',
        right: '#b8b8bb',
      }),
    ).toBe(true)
  })

  it('rejects brand accents', () => {
    expect(
      isNearGreyscale({
        top: '#7ba3c9',
        left: '#5b87b0',
        right: '#4a7199',
      }),
    ).toBe(false)
  })
})

describe('tintColorMatrixValues', () => {
  it('returns null for greyscale tint', () => {
    expect(
      tintColorMatrixValues({
        top: '#e8e8ea',
        left: '#d2d2d4',
        right: '#b8b8bb',
      }),
    ).toBeNull()
  })

  it('returns null when tint missing', () => {
    expect(tintColorMatrixValues(undefined)).toBeNull()
    expect(tintColorMatrixValues(null)).toBeNull()
  })

  it('builds matrix from accent top', () => {
    const m = tintColorMatrixValues({
      top: '#ff0000',
      left: '#cc0000',
      right: '#990000',
    })
    expect(m).toBe('1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0')
  })
})
