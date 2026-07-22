import { describe, expect, it } from 'vitest'
import {
  displayPlanTierLabel,
  isChaosTrialUsedMessage,
  UPGRADE_TO_ENGINEER_LABEL,
} from './billingCopy'

describe('billingCopy', () => {
  it('exposes upgrade CTA label', () => {
    expect(UPGRADE_TO_ENGINEER_LABEL).toBe('Upgrade to Engineer')
  })

  it('maps plan labels without exposing internal', () => {
    expect(displayPlanTierLabel('free')).toBe('Explorer')
    expect(displayPlanTierLabel('engineer')).toBe('Engineer')
    expect(displayPlanTierLabel('internal')).toBe('Engineer')
  })

  it('detects chaos trial messages', () => {
    expect(
      isChaosTrialUsedMessage(
        'chaos trial already used — upgrade to continue',
      ),
    ).toBe(true)
    expect(isChaosTrialUsedMessage('forbidden')).toBe(false)
  })
})
