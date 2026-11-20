import { describe, expect, it } from 'vitest'
import {
  PROVISION_GHOST_FILTER_IDS,
  provisionGhostFilterUrl,
} from './provisionGhostFilters'

describe('provisionGhostFilterUrl', () => {
  it('desaturates pending and building, not ready', () => {
    expect(provisionGhostFilterUrl('pending')).toBe(
      `url(#${PROVISION_GHOST_FILTER_IDS.pending})`,
    )
    expect(provisionGhostFilterUrl('building')).toBe(
      `url(#${PROVISION_GHOST_FILTER_IDS.building})`,
    )
    expect(provisionGhostFilterUrl('ready')).toBeUndefined()
    expect(provisionGhostFilterUrl('off')).toBeUndefined()
  })
})
