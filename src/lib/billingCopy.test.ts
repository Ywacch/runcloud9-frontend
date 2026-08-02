import { describe, expect, it } from 'vitest'
import {
  displayPlanTierLabel,
  engineerBenefitIncluded,
  ENGINEER_BENEFIT_ROWS,
  ENGINEER_PRICE_DISPLAY,
  engineerUpgradeActionLabel,
  engineerUpgradeCta,
  EXPLORER_PRICE_DISPLAY,
  formatSessionsLeftThisMonth,
  isChaosTrialUsedMessage,
  PUBLISHED_TIER_LIMITS,
  REPLICAS_HELP_FREE,
  replicasHelpPaid,
  resolveEngineerPriceDisplay,
  RESOURCE_PROFILE_HELPER,
  TIER_COMPARE_ROWS,
  UPGRADE_TO_ENGINEER_LABEL,
  UPGRADE_TO_SCALE_REPLICAS_TOOLTIP,
  UPGRADE_TO_UNLOCK_TOOLTIP,
} from './billingCopy'

describe('billingCopy', () => {
  it('exposes upgrade CTA label', () => {
    expect(UPGRADE_TO_ENGINEER_LABEL).toBe('Upgrade to Engineer')
  })

  it('exposes stop and cancel billing labels', async () => {
    const {
      STOP_SUBSCRIPTION_LABEL,
      CANCEL_SUBSCRIPTION_LABEL,
      MANAGE_BILLING_HINT,
    } = await import('./billingCopy')
    expect(STOP_SUBSCRIPTION_LABEL).toBe('Stop subscription')
    expect(CANCEL_SUBSCRIPTION_LABEL).toBe('Cancel & refund')
    expect(MANAGE_BILLING_HINT.length).toBeGreaterThan(20)
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

  it('maps engineer benefits from limits', () => {
    const free = {
      allowLoadBalancer: false,
      allowMQWorker: false,
      allowProxyCache: false,
      allTemplates: false,
    }
    const engineer = {
      allowLoadBalancer: true,
      allowMQWorker: true,
      allowProxyCache: true,
      allTemplates: true,
    }
    expect(engineerBenefitIncluded('load_balancer', free)).toBe(false)
    expect(engineerBenefitIncluded('load_balancer', engineer)).toBe(true)
    expect(engineerBenefitIncluded('all_templates', engineer)).toBe(true)
  })

  it('describes locked full-architecture preview for Explorer LB/MQ notes', () => {
    const lb = ENGINEER_BENEFIT_ROWS.find((r) => r.id === 'load_balancer')
    const mq = ENGINEER_BENEFIT_ROWS.find((r) => r.id === 'mq_worker')
    expect(lb?.explorerNote).toMatch(/full architecture/i)
    expect(lb?.explorerNote).not.toMatch(/omit/i)
    expect(mq?.explorerNote).toMatch(/full architecture/i)
  })

  it('publishes Explorer vs Engineer limits aligned with GetTierLimits', () => {
    expect(PUBLISHED_TIER_LIMITS.explorer).toEqual({
      maxConcurrent: 1,
      sessionMinsLabel: '9 min',
      maxSessionsPerMonth: 5,
      maxAppServerReplicas: 1,
    })
    expect(PUBLISHED_TIER_LIMITS.engineer).toEqual({
      maxConcurrent: 1,
      sessionMinsLabel: '9–15 min',
      maxSessionsPerMonth: 20,
      maxAppServerReplicas: 3,
    })
  })

  it('exposes a complete tier compare matrix for pricing surfaces', () => {
    expect(TIER_COMPARE_ROWS.map((r) => r.id)).toEqual([
      'concurrent',
      'session_length',
      'sessions_month',
      'replicas',
      'load_balancer',
      'mq_worker',
      'proxy_cache',
      'templates',
      'chaos',
    ])
    for (const row of TIER_COMPARE_ROWS) {
      expect(row.label.length).toBeGreaterThan(0)
      expect(row.explorer.length).toBeGreaterThan(0)
      expect(row.engineer.length).toBeGreaterThan(0)
    }
    expect(
      TIER_COMPARE_ROWS.find((r) => r.id === 'sessions_month')?.explorer,
    ).toBe('5')
    expect(
      TIER_COMPARE_ROWS.find((r) => r.id === 'sessions_month')?.engineer,
    ).toBe('20')
  })

  it('resolves Engineer price display from env with checkout fallback', () => {
    expect(resolveEngineerPriceDisplay(undefined)).toBe('Shown at checkout')
    expect(resolveEngineerPriceDisplay('')).toBe('Shown at checkout')
    expect(resolveEngineerPriceDisplay('  ')).toBe('Shown at checkout')
    expect(resolveEngineerPriceDisplay(' $29 ')).toBe('$29')
    expect(EXPLORER_PRICE_DISPLAY).toBe('$0')
    expect(typeof ENGINEER_PRICE_DISPLAY).toBe('string')
    expect(ENGINEER_PRICE_DISPLAY.length).toBeGreaterThan(0)
  })

  it('returns upgrade CTA only when billing is enabled', () => {
    expect(engineerUpgradeCta(false)).toBeNull()
    expect(engineerUpgradeActionLabel(false)).toBeUndefined()
    expect(engineerUpgradeCta(true)).toEqual({
      label: UPGRADE_TO_ENGINEER_LABEL,
    })
    expect(engineerUpgradeActionLabel(true)).toBe(UPGRADE_TO_ENGINEER_LABEL)
  })
})
