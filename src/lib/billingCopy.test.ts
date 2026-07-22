import { describe, expect, it } from 'vitest'
import {
  displayPlanTierLabel,
  formatSessionsLeftThisMonth,
  isChaosTrialUsedMessage,
  REPLICAS_HELP_FREE,
  replicasHelpPaid,
  RESOURCE_PROFILE_HELPER,
  UPGRADE_TO_ENGINEER_LABEL,
  UPGRADE_TO_SCALE_REPLICAS_TOOLTIP,
  UPGRADE_TO_UNLOCK_TOOLTIP,
} from './billingCopy'

describe('billingCopy', () => {
  it('exposes upgrade CTA label', () => {
    expect(UPGRADE_TO_ENGINEER_LABEL).toBe('Upgrade to Engineer')
  })

  it('exposes free-tier upgrade tooltips', () => {
    expect(UPGRADE_TO_UNLOCK_TOOLTIP).toBe(
      'Upgrade to Engineer to unlock this',
    )
    expect(UPGRADE_TO_SCALE_REPLICAS_TOOLTIP).toBe(
      'Upgrade to Engineer to scale replicas up to 2 extra instances',
    )
  })

  it('exposes resource and replicas helper copy', () => {
    expect(RESOURCE_PROFILE_HELPER).toBe(
      'Adjust CPU and memory for this component.',
    )
    expect(REPLICAS_HELP_FREE).toBe('Explorer runs one App Server pod.')
    expect(replicasHelpPaid(3)).toBe(
      'Deploy runs this many App Server pods (1–3). Click an App Server on the grid to add another.',
    )
  })

  it('maps plan labels without exposing internal', () => {
    expect(displayPlanTierLabel('free')).toBe('Explorer')
    expect(displayPlanTierLabel('engineer')).toBe('Engineer')
    expect(displayPlanTierLabel('internal')).toBe('Engineer')
  })

  it('formats monthly sessions remaining', () => {
    expect(formatSessionsLeftThisMonth(3, 5)).toBe('3 of 5 left')
    expect(formatSessionsLeftThisMonth(0, 5)).toBe('0 of 5 left')
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
