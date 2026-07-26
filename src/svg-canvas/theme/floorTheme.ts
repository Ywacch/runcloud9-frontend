/**
 * Canvas-scoped floor appearance (independent of app `--c9-*` chrome tokens).
 * Dark matches the Pixi host (`#13111c`) and muted iso grid strokes.
 */

export type FloorThemeId = 'dark' | 'light'

export type FloorThemeTokens = {
  id: FloorThemeId
  hostBg: string
  floorFill: string
  gridMinor: string
  gridMajor: string
  slabSideFront: string
  slabSideRight: string
  slabRim: string
}

export const FLOOR_THEMES: Record<FloorThemeId, FloorThemeTokens> = {
  dark: {
    id: 'dark',
    hostBg: '#13111c',
    floorFill: '#1c1a27',
    gridMinor: 'rgba(170,170,170,0.25)',
    gridMajor: 'rgba(170,170,170,0.45)',
    slabSideFront: '#2a2836',
    slabSideRight: '#22202e',
    slabRim: 'rgba(170,170,170,0.55)',
  },
  light: {
    id: 'light',
    hostBg: '#f4f5f7',
    floorFill: '#ffffff',
    gridMinor: '#eeeeee',
    gridMajor: '#54626f',
    slabSideFront: '#d4d4d8',
    slabSideRight: '#a1a1aa',
    slabRim: '#54626f',
  },
}

export function floorThemeTokens(id: FloorThemeId): FloorThemeTokens {
  return FLOOR_THEMES[id]
}
