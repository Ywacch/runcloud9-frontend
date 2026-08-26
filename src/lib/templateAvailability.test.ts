import { describe, expect, it } from 'vitest'
import {
  templateCanLoadInPicker,
  templateOfferBadge,
  templateOffersLiveDeploy,
} from './templateAvailability'

describe('templateOffersLiveDeploy', () => {
  it('requires available and deployable', () => {
    expect(
      templateOffersLiveDeploy({
        available: true,
        deployable: true,
        simulatable: false,
      }),
    ).toBe(true)
    expect(
      templateOffersLiveDeploy({
        available: false,
        deployable: true,
        simulatable: true,
      }),
    ).toBe(false)
    expect(
      templateOffersLiveDeploy({
        available: true,
        deployable: false,
        simulatable: true,
      }),
    ).toBe(false)
  })
})

describe('templateCanLoadInPicker', () => {
  it('allows load when live deploy is offered', () => {
    expect(
      templateCanLoadInPicker({
        available: true,
        deployable: true,
        simulatable: false,
      }),
    ).toBe(true)
  })

  it('allows load for simulation when live is not offered', () => {
    expect(
      templateCanLoadInPicker({
        available: false,
        deployable: true,
        simulatable: true,
      }),
    ).toBe(true)
  })

  it('blocks load when neither live nor simulation is offered', () => {
    expect(
      templateCanLoadInPicker({
        available: false,
        deployable: true,
        simulatable: false,
      }),
    ).toBe(false)
    expect(
      templateCanLoadInPicker({
        available: false,
        deployable: false,
        simulatable: false,
      }),
    ).toBe(false)
  })
})

describe('templateOfferBadge', () => {
  it('uses coming-soon when available is false, even if deployable', () => {
    expect(
      templateOfferBadge({
        available: false,
        deployable: true,
        simulatable: true,
      }),
    ).toBe('coming-soon')
  })

  it('uses ready only when available and deployable', () => {
    expect(
      templateOfferBadge({
        available: true,
        deployable: true,
        simulatable: true,
      }),
    ).toBe('ready')
  })

  it('uses simulation-only when available but not deployable', () => {
    expect(
      templateOfferBadge({
        available: true,
        deployable: false,
        simulatable: true,
      }),
    ).toBe('simulation-only')
  })
})
