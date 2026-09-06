import { describe, expect, it, vi } from 'vitest'
import {
  remoteTemplateVisibleInPicker,
  templateCanLoadInPicker,
  templateOfferBadge,
  templateOffersLiveDeploy,
} from './templateAvailability'

vi.mock('./featureFlags', () => ({
  SHOW_SIMULATION_UI: false,
}))

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

  it('blocks simulation-only templates when simulation UI is hidden', () => {
    expect(
      templateCanLoadInPicker({
        available: false,
        deployable: true,
        simulatable: true,
      }),
    ).toBe(false)
    expect(
      templateCanLoadInPicker({
        available: true,
        deployable: false,
        simulatable: true,
      }),
    ).toBe(false)
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

describe('remoteTemplateVisibleInPicker', () => {
  it('keeps premium deployable templates visible with lock UX', () => {
    expect(
      remoteTemplateVisibleInPicker(
        {
          available: true,
          deployable: true,
          simulatable: false,
          premium: true,
        },
        false,
      ),
    ).toBe(true)
  })

  it('hides unavailable simulation-only remote templates', () => {
    expect(
      remoteTemplateVisibleInPicker(
        {
          available: true,
          deployable: false,
          simulatable: true,
          premium: false,
        },
        true,
      ),
    ).toBe(false)
  })
})
