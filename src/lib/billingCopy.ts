/** Billing UI copy helpers — no Supabase/auth imports (safe for unit tests in CI). */

export const UPGRADE_TO_ENGINEER_LABEL = 'Upgrade to Engineer'

export const STOP_SUBSCRIPTION_LABEL = 'Stop subscription'

export const CANCEL_SUBSCRIPTION_LABEL = 'Cancel & refund'

export const MANAGE_BILLING_HINT =
  'Stop keeps Engineer until the end of this billing period and turns off renewal (resume anytime before then in the portal). Cancel ends Engineer now with a full refund, only if you have not used Engineer this billing period.'

export const MANAGE_BILLING_HINT_STOP_ONLY =
  'Stop keeps Engineer until the end of this billing period and turns off renewal. Cancel & refund is unavailable after you use Engineer this billing period.'

export const CANCEL_SUCCESS_TITLE = 'Subscription canceled'

export const CANCEL_SUCCESS_BODY_REFUNDED =
  'Your Engineer plan has ended and a full refund has been issued. It may take a few days to appear on your statement.'

export const CANCEL_SUCCESS_BODY_NO_REFUND =
  'Your Engineer plan has ended. No refund was issued for this cancellation.'

export const UPGRADE_TO_UNLOCK_TOOLTIP = 'Upgrade to Engineer to unlock this'

export const UPGRADE_TO_SCALE_REPLICAS_TOOLTIP =
  'Upgrade to Engineer to scale replicas up to 2 extra instances'

export const RESOURCE_PROFILE_HELPER =
  'Adjust CPU and memory for this component.'

export const REPLICAS_HELP_FREE = 'Explorer runs one App Server pod.'

export function replicasHelpPaid(maxReplicas: number): string {
  return `Deploy runs this many App Server pods (1-${maxReplicas}). Click the grid to add replicas.`
}

export function isChaosTrialUsedMessage(raw: string): boolean {
  return raw.toLowerCase().includes('chaos trial already used')
}

/** Profile / limits copy when monthly sessions are capped. */
export function formatSessionsLeftThisMonth(
  remaining: number,
  max: number,
): string {
  return `${remaining} of ${max} left`
}

/** Plan label for UI — never expose internal. */
export function displayPlanTierLabel(
  effectiveTier: string | null | undefined,
): string {
  switch (effectiveTier) {
    case 'engineer':
    case 'internal':
      return 'Engineer'
    case 'free':
      return 'Explorer'
    default:
      return 'Explorer'
  }
}

/**
 * Published Explorer / Engineer caps for marketing matrices.
 * Keep aligned with ganymede `store.GetTierLimits` (free / engineer).
 */
export const PUBLISHED_TIER_LIMITS = {
  explorer: {
    maxConcurrent: 1,
    sessionMinsLabel: '9 min',
    maxSessionsPerMonth: 5,
    maxAppServerReplicas: 1,
  },
  engineer: {
    maxConcurrent: 1,
    sessionMinsLabel: '15 min',
    maxSessionsPerMonth: 20,
    maxAppServerReplicas: 3,
  },
} as const

export const EXPLORER_PRICE_DISPLAY = '$0'

const ENGINEER_PRICE_FALLBACK = 'Shown at checkout'

/** Resolve Engineer marketing price; Stripe checkout remains authoritative. */
export function resolveEngineerPriceDisplay(
  envValue: string | undefined = import.meta.env.VITE_ENGINEER_PRICE_LABEL,
): string {
  const trimmed = String(envValue ?? '').trim()
  return trimmed.length > 0 ? trimmed : ENGINEER_PRICE_FALLBACK
}

export const ENGINEER_PRICE_DISPLAY = resolveEngineerPriceDisplay()

/**
 * Upgrade CTA for marketing / account surfaces.
 * When billing is off, return null so UI does not fake a checkout path.
 */
export function engineerUpgradeCta(billingEnabled: boolean): {
  label: string
} | null {
  if (!billingEnabled) return null
  return { label: UPGRADE_TO_ENGINEER_LABEL }
}

/** Same gate as deploy upgrade actions; string form for simple call sites. */
export function engineerUpgradeActionLabel(
  billingEnabled: boolean,
): string | undefined {
  return engineerUpgradeCta(billingEnabled)?.label
}

export type TierCompareRowId =
  | 'concurrent'
  | 'session_length'
  | 'sessions_month'
  | 'replicas'
  | 'load_balancer'
  | 'mq_worker'
  | 'proxy_cache'
  | 'templates'
  | 'chaos'

export type TierCompareRow = {
  id: TierCompareRowId
  label: string
  explorer: string
  engineer: string
}

/** Pricing / profile matrix — single source for Explorer vs Engineer cells. */
export const TIER_COMPARE_ROWS: TierCompareRow[] = [
  {
    id: 'concurrent',
    label: 'Concurrent deployments',
    explorer: String(PUBLISHED_TIER_LIMITS.explorer.maxConcurrent),
    engineer: String(PUBLISHED_TIER_LIMITS.engineer.maxConcurrent),
  },
  {
    id: 'session_length',
    label: 'Session length cap',
    explorer: PUBLISHED_TIER_LIMITS.explorer.sessionMinsLabel,
    engineer: PUBLISHED_TIER_LIMITS.engineer.sessionMinsLabel,
  },
  {
    id: 'sessions_month',
    label: 'Sessions per month',
    explorer: String(PUBLISHED_TIER_LIMITS.explorer.maxSessionsPerMonth),
    engineer: String(PUBLISHED_TIER_LIMITS.engineer.maxSessionsPerMonth),
  },
  {
    id: 'replicas',
    label: 'App server & worker replicas',
    explorer: String(PUBLISHED_TIER_LIMITS.explorer.maxAppServerReplicas),
    engineer: String(PUBLISHED_TIER_LIMITS.engineer.maxAppServerReplicas),
  },
  {
    id: 'load_balancer',
    label: 'Load balancers',
    explorer: 'Full architecture preview (locked)',
    engineer: 'Included',
  },
  {
    id: 'mq_worker',
    label: 'Message queue + worker',
    explorer: 'Full architecture preview (locked)',
    engineer: 'Included',
  },
  {
    id: 'proxy_cache',
    label: 'Cache proxy strategies',
    explorer: 'Cache-aside only',
    engineer: 'Write-through & write-behind',
  },
  {
    id: 'templates',
    label: 'Templates',
    explorer: 'Free templates',
    engineer: 'All templates',
  },
  {
    id: 'chaos',
    label: 'Fault triggers',
    explorer: 'One trial per feature',
    engineer: 'Unlimited',
  },
]

export type EngineerBenefitId =
  | 'load_balancer'
  | 'mq_worker'
  | 'proxy_cache'
  | 'higher_quotas'
  | 'all_templates'

export type EngineerBenefitRow = {
  id: EngineerBenefitId
  label: string
  explorerNote?: string
}

/** Upgrade checklist copy — shared by profile and billing surfaces. */
export const ENGINEER_BENEFIT_ROWS: EngineerBenefitRow[] = [
  {
    id: 'load_balancer',
    label: 'Load balancers in presets and on canvas',
    explorerNote:
      'Shown locked on full architecture; switch to Explorer runnable to deploy without them',
  },
  {
    id: 'mq_worker',
    label: 'Message queue + worker (async fan-out)',
    explorerNote:
      'Shown locked on full architecture; switch to Explorer runnable to deploy without them',
  },
  {
    id: 'proxy_cache',
    label: 'Write-through & write-behind cache proxy strategies',
    explorerNote: 'Cache-aside only on Explorer',
  },
  {
    id: 'higher_quotas',
    label: 'Higher monthly sessions, replicas, and resource caps',
  },
  {
    id: 'all_templates',
    label: 'All templates unlocked',
    explorerNote: 'Premium templates require Engineer',
  },
]

export function engineerBenefitIncluded(
  id: EngineerBenefitId,
  limits: {
    allowLoadBalancer?: boolean
    allowMQWorker?: boolean
    allowProxyCache?: boolean
    allTemplates?: boolean
  } | null | undefined,
): boolean {
  if (!limits) return false
  switch (id) {
    case 'load_balancer':
      return limits.allowLoadBalancer === true
    case 'mq_worker':
      return limits.allowMQWorker === true
    case 'proxy_cache':
      return limits.allowProxyCache === true
    case 'higher_quotas':
      return (
        limits.allowLoadBalancer === true ||
        limits.allowMQWorker === true ||
        limits.allowProxyCache === true
      )
    case 'all_templates':
      return limits.allTemplates === true
    default:
      return false
  }
}
