import { describe, expect, it } from 'vitest'
import { healthRimStyle } from '../../canvas/utils/healthVisual'
import { resolveRimStyle, rimCssColor } from './healthRimCss'
import { particleFade, wrapProgress } from './pathProgress'

describe('healthRimCss', () => {
  it('converts Pixi hex to CSS', () => {
    expect(rimCssColor(0x22c55e)).toBe('#22c55e')
    expect(rimCssColor(0xef4444)).toBe('#ef4444')
    expect(rimCssColor(0xa78bfa)).toBe('#a78bfa')
  })

  it('treats omitted / off as no rim', () => {
    expect(resolveRimStyle(undefined)).toBeNull()
    expect(resolveRimStyle('off')).toBeNull()
    expect(resolveRimStyle('idle')).toBeNull()
  })

  it('resolves warning style with pulse', () => {
    const style = resolveRimStyle('warning')
    expect(style).toEqual(healthRimStyle('warning'))
    expect(style?.pulseSpeed).toBeGreaterThan(0)
  })
})

describe('pathProgress', () => {
  it('fades near path ends like Pixi TrafficLayer', () => {
    expect(particleFade(0)).toBe(0)
    expect(particleFade(1)).toBe(0)
    expect(particleFade(0.5)).toBe(1)
    expect(particleFade(0.05)).toBeCloseTo(0.4)
  })

  it('wraps progress into [0, 1)', () => {
    expect(wrapProgress(1.25)).toBeCloseTo(0.25)
    expect(wrapProgress(-0.1)).toBeCloseTo(0.9)
    expect(wrapProgress(0.3)).toBeCloseTo(0.3)
  })
})
