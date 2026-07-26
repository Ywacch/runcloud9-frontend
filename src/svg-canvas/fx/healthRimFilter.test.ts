import { describe, expect, it } from 'vitest'
import {
  HEALTH_RIM_FILTER_IDS,
  healthRimFilterId,
  healthRimFloodColor,
  healthRimLayerOpacity,
} from './healthRimFilter'

describe('healthRimFilterId', () => {
  it('returns null when health is off or idle', () => {
    expect(healthRimFilterId('off')).toBeNull()
    expect(healthRimFilterId('idle')).toBeNull()
    expect(healthRimFilterId(undefined)).toBeNull()
  })

  it('maps live states to shared filter ids', () => {
    expect(healthRimFilterId('healthy')).toBe(HEALTH_RIM_FILTER_IDS.healthy)
    expect(healthRimFilterId('warning')).toBe(HEALTH_RIM_FILTER_IDS.warning)
    expect(healthRimFilterId('error')).toBe(HEALTH_RIM_FILTER_IDS.error)
    expect(healthRimFilterId('chaos')).toBe(HEALTH_RIM_FILTER_IDS.chaos)
  })
})

describe('healthRimFloodColor', () => {
  it('matches the Pixi rim palette', () => {
    expect(healthRimFloodColor('healthy')).toBe('#22c55e')
    expect(healthRimFloodColor('warning')).toBe('#f59e0b')
    expect(healthRimFloodColor('error')).toBe('#ef4444')
    expect(healthRimFloodColor('chaos')).toBe('#a78bfa')
  })
})

describe('healthRimLayerOpacity', () => {
  it('floors opacity so SVG rims stay readable', () => {
    expect(healthRimLayerOpacity(0)).toBe(0.55)
    expect(healthRimLayerOpacity(0.35)).toBe(0.7)
    expect(healthRimLayerOpacity(1)).toBe(1)
  })
})
