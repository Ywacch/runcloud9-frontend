import { describe, expect, it } from 'vitest'
import { FLOOR_THEMES, floorThemeTokens } from './floorTheme'

describe('floorTheme', () => {
  it('dark host matches the Observe page background', () => {
    expect(floorThemeTokens('dark').hostBg).toBe('#15152a')
  })

  it('light keeps the prior Cloudcraft-style floor fill', () => {
    expect(floorThemeTokens('light').floorFill).toBe('#ffffff')
    expect(floorThemeTokens('light').hostBg).toBe('#f4f5f7')
  })

  it('exposes both themes', () => {
    expect(Object.keys(FLOOR_THEMES).sort()).toEqual(['dark', 'light'])
  })
})
