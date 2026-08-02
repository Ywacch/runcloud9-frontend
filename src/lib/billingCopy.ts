/** Billing UI copy helpers — no Supabase/auth imports (safe for unit tests in CI). */

export const UPGRADE_TO_ENGINEER_LABEL = 'Upgrade to Engineer'

export const STOP_SUBSCRIPTION_LABEL = 'Stop subscription'

export const CANCEL_SUBSCRIPTION_LABEL = 'Cancel & refund'

export const MANAGE_BILLING_HINT =
  'Stop keeps Engineer until the end of this billing period and turns off renewal (resume anytime before then in the portal). Cancel ends Engineer now with a full refund — only if you have not used Engineer this billing period.'

export const UPGRADE_TO_UNLOCK_TOOLTIP = 'Upgrade to Engineer to unlock this'

export const UPGRADE_TO_SCALE_REPLICAS_TOOLTIP =
  'Upgrade to Engineer to scale replicas up to 2 extra instances'

export const RESOURCE_PROFILE_HELPER =
  'Adjust CPU and memory for this component.'

export const REPLICAS_HELP_FREE = 'Explorer runs one App Server pod.'

export function replicasHelpPaid(maxReplicas: number): string {
  return `Deploy runs this many App Server pods (1–${maxReplicas}). Click an App Server on the grid to add another.`
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
    explorerNote: 'Explorer presets omit load balancers',
  },
  {
    id: 'mq_worker',
    label: 'Message queue + worker (async fan-out)',
    explorerNote: 'Not available on Explorer',
  },
  {
    id: 'proxy_cache',
    label: 'Write-through / write-behind cache proxy strategies',
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
