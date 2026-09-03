import { describe, expect, it } from 'vitest'
import { TEMPLATE_FAMILIES } from './templateFamilyCatalog'

describe('templateFamilyCatalog', () => {
  it('defines three families with three variations each', () => {
    expect(TEMPLATE_FAMILIES).toHaveLength(3)
    for (const family of TEMPLATE_FAMILIES) {
      expect(family.slots).toHaveLength(3)
      expect(family.title.length).toBeGreaterThan(0)
      expect(family.summary.length).toBeGreaterThan(0)
    }
  })

  it('places social-feed-pull before social-feed push variants', () => {
    const social = TEMPLATE_FAMILIES.find((f) => f.id === 'social-feed')
    expect(social?.slots[0]).toEqual({
      templateId: 'social-feed-pull',
      variationId: 'app-db',
    })
    expect(social?.slots[1]?.templateId).toBe('social-feed')
    expect(social?.slots[1]?.variationId).toBe('timeline-sync')
    expect(social?.slots[2]?.variationId).toBe('timeline-async')
  })
})
